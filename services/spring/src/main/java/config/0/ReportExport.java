package ocv.pinia.slot2;

import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.GetResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.Connection;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

@Component
public class ReportExport {
    private static final String QUEUE = "ocv_shared_receipt_2";
    private final old stock;
    private final ConnectionFactory factory;
    private final boolean enabled;
    private final Semaphore channelSlot = new Semaphore(1, true);

    public ReportExport(old stock, ConnectionFactory factory, @Value("${ocv.shared.amqp:false}") boolean enabled) {
        this.stock = stock;
        this.factory = factory;
        this.enabled = enabled;
    }

    public Map<String, Object> send(List<Map<String, Object>> rows, int maximum, UUID job) {
        if (!enabled) throw new ResponseStatusException(HttpStatus.CONFLICT, "The optional confirmed transport is disabled");
        if (!TransactionSynchronizationManager.isActualTransactionActive())
            throw new IllegalStateException("Outbox receipts require a PostgreSQL transaction");
        Session session = null;
        boolean registered = false;
        boolean acquired = false;
        String stage = "connection";
        try {
            if (!channelSlot.tryAcquire(1500, TimeUnit.MILLISECONDS))
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "The receipt transport is busy");
            acquired = true;
            session = new Session(factory.createConnection(), channelSlot);
            Channel channel = session.channel;
            stage = "queue";
            channel.queueDeclare(QUEUE, true, false, false,
                    Map.of("x-max-length", 512, "x-message-ttl", 600000, "x-overflow", "reject-publish"));
            channel.basicQos(8);
            stage = "confirm-select";
            channel.confirmSelect();
            AMQP.BasicProperties properties = new AMQP.BasicProperties.Builder()
                    .contentType("application/json").deliveryMode(2).type("ocv.task-notice/1").build();
            List<Long> published = new ArrayList<>();
            stage = "publish";
            for (Map<String, Object> row : rows) {
                long serial = ((Number) row.get("seq")).longValue();
                if (((Number) row.get("attempts")).intValue() >= 8)
                    throw ocv.assets.bak.Data.conflict("Outbox dispatch attempts exhausted");
                String message = Data.canonical(Map.of("contract", "ocv.task-notice/1", "seq", serial,
                        "job", row.get("job_id").toString(), "payloadSha", row.get("payload_sha")), stock.json, 512);
                channel.basicPublish("", QUEUE, false, properties, message.getBytes(StandardCharsets.UTF_8));
                published.add(serial);
            }
            stage = "confirm-wait";
            if (!published.isEmpty()) channel.waitForConfirmsOrDie(1500);
            for (Long serial : published) stock.dispatched(serial);
            List<Long> delivered = new ArrayList<>();
            int duplicates = 0;
            int expired = 0;
            stage = "readback";
            for (int count = 0; count < maximum; count++) {
                GetResponse received = channel.basicGet(QUEUE, false);
                if (received == null) break;
                session.tags.add(received.getEnvelope().getDeliveryTag());
                if (received.getBody().length > 512) throw ocv.assets.bak.Data.conflict("Broker task notice exceeds its schema");
                Object decoded = stock.object(new String(received.getBody(), StandardCharsets.UTF_8));
                if (!(decoded instanceof Map<?, ?> note) || !note.keySet().equals(java.util.Set.of("contract", "seq", "job", "payloadSha"))
                        || !"ocv.task-notice/1".equals(note.get("contract")) || !(note.get("seq") instanceof Number serial)
                        || serial.longValue() < 1 || serial.doubleValue() != serial.longValue())
                    throw ocv.assets.bak.Data.conflict("Broker task notice does not match its fixed schema");
                Map<String, Object> row;
                try { row = stock.message(serial.longValue()); }
                catch (ResponseStatusException failure) {
                    if (failure.getStatusCode().value() != 409) throw failure;
                    // A retained queue notice can outlive the bounded canonical job history.
                    expired++;
                    continue;
                }
                if (!row.get("job_id").toString().equals(note.get("job")) || !row.get("payload_sha").equals(note.get("payloadSha")))
                    throw ocv.assets.bak.Data.conflict("Broker task notice checksum mismatch");
                if (stock.acknowledge(row, "rabbitmq-confirmed")) duplicates++;
                delivered.add(serial.longValue());
            }
            Session committed = session;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCompletion(int status) {
                    committed.finish(status == STATUS_COMMITTED);
                }
            });
            registered = true;
            delivered.sort(Comparator.naturalOrder());
            Integer pending = stock.jdbc.queryForObject(
                    "SELECT count(*) FROM ocv_shared1.dispatch_outbox WHERE job_id=?::uuid AND delivery='pending'",
                    Integer.class, job.toString());
            return Map.of("ok", true, "contract", "ocv.task-outbox/1", "published", published,
                    "delivered", delivered, "duplicates", duplicates, "expired", expired,
                    "pending", pending == null ? 0 : pending, "transport", "rabbitmq-confirmed",
                    "brokerConfirmed", true, "deliveryGuarantee", "at-least-once with PostgreSQL inbox deduplication");
        } catch (ResponseStatusException failure) { throw failure; }
        catch (Exception failure) {
            if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
            LoggerFactory.getLogger("ReportExport").warn("Confirmed task transport failed at {}; cause-type={}; channel-open={}",
                    stage, failure.getClass().getSimpleName(), session != null && session.channel.isOpen());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Confirmed outbox transport is unavailable");
        } finally {
            if (session != null && !registered) session.finish(false);
            else if (session == null && acquired) channelSlot.release();
        }
    }

    private static final class Session {
        final Connection connection;
        final Channel channel;
        final List<Long> tags = new ArrayList<>();
        final Semaphore slot;
        final AtomicBoolean finished = new AtomicBoolean();
        Session(Connection connection, Semaphore slot) {
            this.connection = connection;
            this.slot = slot;
            try {
                // A cached ChannelProxy may replace its target after a shutdown and lose our manual confirm mode.
                // This receipt transaction owns one physical channel; it must never return it to a channel cache.
                com.rabbitmq.client.Connection delegate = connection.getDelegate();
                if (delegate == null || !delegate.isOpen())
                    throw new IllegalStateException("The broker connection has no open physical delegate");
                Channel physical = delegate.createChannel();
                if (physical == null) throw new IllegalStateException("The broker channel limit has been reached");
                this.channel = physical;
            }
            catch (Exception failure) {
                connection.close();
                throw new IllegalStateException("The receipt channel could not be opened", failure);
            }
        }
        void finish(boolean committed) {
            if (!finished.compareAndSet(false, true)) return;
            try {
                for (Long tag : tags) {
                    if (committed) channel.basicAck(tag, false);
                    else channel.basicNack(tag, false, true);
                }
            } catch (Exception failure) {
                LoggerFactory.getLogger("ReportExport").warn("Task broker acknowledgement deferred; inbox replay remains idempotent");
            } finally {
                try { channel.close(); }
                catch (Exception ignored) { try { channel.abort(); } catch (Exception deferred) { } }
                finally { try { connection.close(); } finally { slot.release(); } }
            }
        }
    }
}
