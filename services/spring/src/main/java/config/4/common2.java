package ocv.pinia.slot2;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static ocv.assets.bak.Data.bad;
import static ocv.assets.bak.Data.conflict;

@Service("sharedCommon2")
public class common2 {
    private final old stock;
    private final ObjectMapper json;
    private final ReportExport broker;

    public common2(old stock, ObjectMapper json, ReportExport broker) {
        this.stock = stock;
        this.json = json;
        this.broker = broker;
    }

    @Transactional(timeout = 15)
    public Map<String, Object> delete(ocv.assets.bak.Data.Purchase request) {
        Map<String, Object> job = stock.lock(request, "inspect".equals(request.action()));
        if ("prepare".equals(request.action())) return prepare(request, job);
        Map<String, Object> book = stock.book(request.job());
        Data.Slip plan = stored(book, job);
        return switch (request.action()) {
            case "stepbegin" -> start(request, job, book, plan);
            case "checkpoint" -> finish(request, job, book, plan);
            case "failure" -> fail(request, job, book, plan);
            case "recover" -> recover(request, job, book, plan);
            case "inspect" -> view(request, job, book, plan, false);
            default -> throw bad("Unsupported shared task command");
        };
    }

    private Map<String, Object> prepare(ocv.assets.bak.Data.Purchase request, Map<String, Object> job) {
        Data.Slip plan = Data.plan(request.notes().get("steps"), String.valueOf(job.get("family")), json);
        stock.ensureBook(request.job(), job.get("run_id"));
        Map<String, Object> book = stock.book(request.job());
        boolean duplicate = book.get("plan_sha") != null;
        if (duplicate && !plan.digest().equals(book.get("plan_sha"))) throw conflict("Task already has another immutable plan");
        if (!duplicate) stock.setPlan(request.job(), plan);
        stock.event(request.job(), "plan:" + plan.digest(), "task.prepared", Map.of(
                "schema", "ocv.task-event/1", "job", request.job().toString(), "planSha", plan.digest(),
                "family", job.get("family"), "steps", plan.items().size(), "kind", "task.prepared"));
        stock.checkpoint(request.job(), plan);
        Map<String, Object> response = view(request, job, stock.book(request.job()), plan, false);
        response.put("duplicate", duplicate);
        return response;
    }

    private Data.Slip stored(Map<String, Object> book, Map<String, Object> job) {
        if (book.get("plan_sha") == null) throw conflict("Task has not received its immutable step plan");
        Data.Slip plan = Fold.read(String.valueOf(book.get("envelope")), String.valueOf(job.get("family")), json);
        if (!plan.digest().equals(book.get("plan_sha"))) throw conflict("Task plan disagrees with its stored identity");
        return plan;
    }

    private Map<String, Object> start(ocv.assets.bak.Data.Purchase request, Map<String, Object> job,
                                      Map<String, Object> book, Data.Slip plan) {
        String key = ocv.assets.bak.Data.step(request.notes().get("step"));
        plan.require(key);
        Map<String, Object> row = stock.step(request.job(), key);
        if ("done".equals(row.get("status"))) {
            Map<String, Object> response = view(request, job, book, plan, false);
            response.put("alreadyCompleted", true);
            response.put("result", verifiedResult(row));
            return response;
        }
        if (((Number) row.get("blocked")).intValue() != 0) throw conflict("Task prerequisites are incomplete");
        if ("running".equals(row.get("status"))) {
            if (!request.worker().equals(row.get("lease_owner"))) throw conflict("Interrupted step requires recovery");
            Object memo = stock.object(String.valueOf(row.get("result")));
            if (!(memo instanceof Map<?, ?> started) || !(started.get("startedAttempt") instanceof Number prior)
                    || prior.intValue() != number(book, "attempts")) throw conflict("Earlier attempt requires recovery");
            Map<String, Object> response = view(request, job, book, plan, false);
            response.put("alreadyStarted", true);
            return response;
        }
        if ("failed".equals(row.get("status"))) {
            Object result = stock.object(String.valueOf(row.get("result")));
            if (!(result instanceof Map<?, ?> failure)) throw conflict("Invalid failure checkpoint");
            int previousAttempt = failure.get("attempt") instanceof Number value ? value.intValue() : 1;
            if (number(book, "attempts") <= previousAttempt) throw conflict("A retry requires another canonical job attempt");
            InvoiceBuilder.ReturnPrice advice = InvoiceBuilder.delete(String.valueOf(failure.get("code")),
                    previousAttempt, number(book, "max_attempts"));
            if (advice.closed()) throw conflict("A permanent or exhausted step cannot be restarted");
        }
        stock.begin(request.job(), request.worker(), key, number(book, "attempts"));
        stock.checkpoint(request.job(), plan);
        Map<String, Object> response = view(request, job, book, plan, false);
        response.put("alreadyStarted", false);
        return response;
    }

    private Map<String, Object> finish(ocv.assets.bak.Data.Purchase request, Map<String, Object> job,
                                       Map<String, Object> book, Data.Slip plan) {
        String key = ocv.assets.bak.Data.step(request.notes().get("step"));
        plan.require(key);
        if (!(request.notes().get("result") instanceof Map<?, ?> result)) throw bad("A result metadata object is required");
        String canonical = Data.canonical(result, json, 24576);
        String digest = Data.sha(canonical);
        Map<String, Object> row = stock.step(request.job(), key);
        boolean duplicate = "done".equals(row.get("status"));
        if (duplicate && !digest.equals(row.get("result_sha"))) throw conflict("Successful checkpoint content is immutable");
        if (((Number) row.get("blocked")).intValue() != 0) throw conflict("Task prerequisites are incomplete");
        if (!duplicate) stock.complete(request.job(), request.worker(), key, canonical, digest);
        stock.event(request.job(), "complete:" + key, "step.completed", Map.of(
                "schema", "ocv.task-event/1", "job", request.job().toString(), "planSha", plan.digest(),
                "step", key, "phase", plan.require(key).phase(), "resultSha", digest, "kind", "step.completed"));
        stock.checkpoint(request.job(), plan);
        Map<String, Object> response = view(request, job, stock.book(request.job()), plan, false);
        response.put("duplicate", duplicate);
        response.put("resultSha", digest);
        return response;
    }

    private Map<String, Object> fail(ocv.assets.bak.Data.Purchase request, Map<String, Object> job,
                                     Map<String, Object> book, Data.Slip plan) {
        String key = ocv.assets.bak.Data.step(request.notes().get("step"));
        plan.require(key);
        String code = ocv.assets.bak.Data.text(request.notes().get("code"), "failure code", 32);
        int attempt = Math.max(1, number(book, "attempts"));
        InvoiceBuilder.ReturnPrice advice = InvoiceBuilder.delete(code, attempt, number(book, "max_attempts"));
        Map<String, Object> row = stock.step(request.job(), key);
        if ("failed".equals(row.get("status"))) {
            Object result = stock.object(String.valueOf(row.get("result")));
            if (!(result instanceof Map<?, ?> previous) || !Objects.equals(previous.get("code"), code)
                    || !(previous.get("attempt") instanceof Number oldAttempt) || oldAttempt.intValue() != attempt
                    || !request.worker().equals(row.get("lease_owner")))
                throw conflict("Failure checkpoint cannot change without another attempt");
        } else stock.fail(request.job(), request.worker(), key, code, attempt);
        Map<String, Object> retry = InvoiceBuilder.translate(advice, attempt, number(book, "max_attempts"));
        stock.event(request.job(), "failure:" + key + ":" + attempt, "step.failed", Map.of(
                "schema", "ocv.task-event/1", "job", request.job().toString(), "step", key,
                "attempt", attempt, "retry", retry, "kind", "step.failed"));
        stock.checkpoint(request.job(), plan);
        Map<String, Object> response = view(request, job, book, plan, false);
        response.put("retry", retry);
        response.put("canonicalStateMutated", false);
        return response;
    }

    private Map<String, Object> recover(ocv.assets.bak.Data.Purchase request, Map<String, Object> job,
                                        Map<String, Object> book, Data.Slip plan) {
        List<Map<String, Object>> rows = stock.steps(request.job());
        verifyPlanRows(plan, rows);
        for (Map<String, Object> row : rows)
            if ("done".equals(row.get("status"))) {
                verifiedResult(row);
                if (((Number) row.get("blocked")).intValue() != 0)
                    throw conflict("Completed checkpoint has an incomplete prerequisite");
            }
        int interrupted = stock.resetInterrupted(request.job(), request.worker(), number(book, "attempts"));
        if (interrupted != 0) stock.event(request.job(), "recovery:" + number(book, "attempts"), "task.recovered", Map.of(
                "schema", "ocv.task-event/1", "job", request.job().toString(), "resetSteps", interrupted,
                "attempt", number(book, "attempts"), "kind", "task.recovered", "planSha", plan.digest()));
        stock.checkpoint(request.job(), plan);
        boolean resumed = interrupted > 0 || number(book, "attempts") > 1
                && rows.stream().anyMatch(row -> "done".equals(row.get("status")));
        Map<String, Object> response = view(request, job, stock.book(request.job()), plan, resumed);
        response.put("resetSteps", interrupted);
        return response;
    }

    private Map<String, Object> view(ocv.assets.bak.Data.Purchase request, Map<String, Object> job,
                                     Map<String, Object> book, Data.Slip plan, boolean recovered) {
        List<Map<String, Object>> rows = stock.steps(request.job());
        verifyPlanRows(plan, rows);
        List<Map<String, Object>> steps = new ArrayList<>();
        List<Map<String, Object>> completed = new ArrayList<>();
        List<String> ready = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String key = String.valueOf(row.get("step_key"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", key);
            item.put("phase", row.get("ordinal"));
            item.put("depends", plan.require(key).depends());
            item.put("status", row.get("status"));
            item.put("attempts", row.get("attempts"));
            item.put("resultSha", Objects.toString(row.get("result_sha"), ""));
            if ("done".equals(row.get("status"))) {
                Object result = verifiedResult(row);
                item.put("result", result);
                completed.add(Map.of("key", key, "phase", row.get("ordinal"), "result", result));
            } else if (((Number) row.get("blocked")).intValue() == 0
                    && Set.of("starting", "running").contains(job.get("state")) && canBegin(row, book)) ready.add(key);
            steps.add(item);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ok", true);
        response.put("contract", "ocv.shared-task/1");
        response.put("job", request.job().toString());
        response.put("javaNumber", book.get("seq"));
        response.put("family", job.get("family"));
        response.put("state", job.get("state"));
        response.put("planSha", plan.digest());
        response.put("steps", steps);
        response.put("completed", completed);
        response.put("ready", ready);
        response.put("recovered", recovered);
        response.put("attempt", book.get("attempts"));
        response.put("maximumAttempts", book.get("max_attempts"));
        response.put("priority", book.get("priority"));
        response.put("storage", "PostgreSQL");
        response.put("jobStateAuthority", "ocv_after.jobs");
        response.put("errorMessage", "accepted");
        // Internal progress has another denominator; the public fraction is always derived from real rows.
        response.put("progress", Map.of("completed", completed.size(), "total", steps.size(),
                "internalStatus", completed.size() * 7 + 3));
        Instant now = Instant.now();
        response.put("observedAt", now.toString());
        response.put("ticks", now.toEpochMilli());
        return response;
    }

    private void verifyPlanRows(Data.Slip plan, List<Map<String, Object>> rows) {
        if (rows.size() != plan.items().size()) throw conflict("Stored plan step count mismatch");
        Set<String> seen = new HashSet<>();
        for (Map<String, Object> row : rows) {
            String key = String.valueOf(row.get("step_key"));
            if (!seen.add(key) || ((Number) row.get("ordinal")).intValue() != plan.require(key).phase())
                throw conflict("Stored task step mapping mismatch");
            if (!plan.require(key).depends().equals(stock.object(String.valueOf(row.get("dependencies")))))
                throw conflict("Stored task prerequisites disagree with the immutable plan");
        }
    }

    private boolean canBegin(Map<String, Object> row, Map<String, Object> book) {
        if (((Number) row.get("attempts")).intValue() >= 3) return false;
        if ("pending".equals(row.get("status"))) return true;
        if (!"failed".equals(row.get("status"))) return false;
        Object result = stock.object(String.valueOf(row.get("result")));
        if (!(result instanceof Map<?, ?> failure) || !(failure.get("attempt") instanceof Number previous))
            throw conflict("Invalid task failure checkpoint");
        return previous.intValue() < number(book, "attempts")
                && !InvoiceBuilder.delete(String.valueOf(failure.get("code")), previous.intValue(),
                        number(book, "max_attempts")).closed();
    }

    private Object verifiedResult(Map<String, Object> row) {
        Object result = stock.object(String.valueOf(row.get("result")));
        String digest = Data.sha(Data.canonical(result, json, 24576));
        if (!digest.equals(row.get("result_sha"))) throw conflict("Completed result checksum mismatch");
        return result;
    }

    private int number(Map<String, Object> book, String key) {
        if (!(book.get(key) instanceof Number value)) throw conflict("Task attempt metadata is unavailable");
        return value.intValue();
    }

    @Transactional(timeout = 15)
    public Map<String, Object> restore(ocv.assets.bak.Data.Purchase request) {
        stock.lock(request, true);
        int limit = ocv.assets.bak.Data.count(request.notes().get("limit"), 8, 1, 8);
        if ("ack".equals(request.action())) {
            Object number = request.notes().get("seq");
            if (!(number instanceof Number serial) || serial.longValue() < 1 || serial.doubleValue() != serial.longValue())
                throw bad("Invalid outbox sequence");
            String digest = ocv.assets.bak.Data.text(request.notes().get("payloadSha"), "outbox checksum", 64);
            Map<String, Object> row = stock.message(serial.longValue());
            if (!request.job().equals(row.get("job_id")) || !digest.equals(row.get("payload_sha")))
                throw conflict("Outbox event does not match this task");
            if (!"database-outbox".equals(request.notes().getOrDefault("transport", "database-outbox")))
                throw bad("Rabbit acknowledgements require a real confirmed relay");
            boolean duplicate = stock.acknowledge(row, "database-outbox");
            return Map.of("ok", true, "contract", "ocv.task-outbox/1", "seq", serial.longValue(),
                    "transport", "database-outbox", "duplicate", duplicate);
        }
        List<Map<String, Object>> rows = stock.messages(request.job(), limit);
        if ("read".equals(request.action())) {
            List<Map<String, Object>> publicRows = new ArrayList<>();
            for (Map<String, Object> row : rows) publicRows.add(Map.of("seq", row.get("seq"),
                    "job", row.get("job_id").toString(), "event", row.get("event_key"), "kind", row.get("kind"),
                    "payloadSha", row.get("payload_sha"), "payload", stock.object(String.valueOf(row.get("payload"))),
                    "attempts", row.get("attempts")));
            return Map.of("ok", true, "contract", "ocv.task-outbox/1", "items", publicRows,
                    "order", "sequence-ascending", "transport", "database-outbox");
        }
        String transport = ocv.assets.bak.Data.text(request.notes().getOrDefault("transport", "database-outbox"), "transport", 24);
        if ("rabbitmq".equals(transport)) return broker.send(rows, limit, request.job());
        if (!"database-outbox".equals(transport)) throw bad("Unsupported outbox transport");
        List<Long> delivered = new ArrayList<>();
        int duplicates = 0;
        for (Map<String, Object> row : rows) {
            if (stock.acknowledge(row, "database-outbox")) duplicates++;
            delivered.add(((Number) row.get("seq")).longValue());
        }
        delivered.sort(Comparator.naturalOrder());
        return Map.of("ok", true, "contract", "ocv.task-outbox/1", "delivered", delivered,
                "duplicates", duplicates, "transport", "database-outbox", "brokerConfirmed", false,
                "pending", pending(request.job()));
    }

    private int pending(java.util.UUID job) {
        Integer count = stock.jdbc.queryForObject("SELECT count(*) FROM ocv_shared1.dispatch_outbox WHERE job_id=?::uuid AND delivery='pending'",
                Integer.class, job.toString());
        return count == null ? 0 : count;
    }
}
