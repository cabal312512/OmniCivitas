package ocv.pinia.slot2;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import static ocv.assets.bak.Data.conflict;

@Component
public class old {
    final JdbcTemplate jdbc;
    final ObjectMapper json;

    public old(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Map<String, Object> lock(ocv.assets.bak.Data.Purchase purchase, boolean terminal) {
        // Always take the shared worker lock before the canonical job lock, as the gateway does.
        List<Map<String, Object>> owners = jdbc.queryForList(
                "SELECT owner,lease_until>now() AS leased FROM ocv_after.worker WHERE id=1 FOR SHARE");
        if (owners.size() != 1 || !Boolean.TRUE.equals(owners.getFirst().get("leased"))
                || !purchase.worker().equals(owners.getFirst().get("owner")))
            throw conflict("The canonical worker lease is unavailable");
        List<Map<String, Object>> records = jdbc.queryForList("""
                SELECT j.id,j.seq,j.run_id,j.family,j.state,j.phase,j.digest,j.result::text AS job_result,
                       COALESCE(n.cancelled,m.cancelled,false) AS cancelled
                FROM ocv_after.jobs j
                LEFT JOIN ocv_signals.dispatch_notes n ON n.id=j.id
                LEFT JOIN ocv_workshop.order_items m ON m.id=j.id
                WHERE j.id=?::uuid FOR UPDATE OF j
                """, purchase.job().toString());
        if (records.size() != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task expired or unavailable");
        Map<String, Object> record = records.getFirst();
        if (!terminal && (Boolean.TRUE.equals(record.get("cancelled"))
                || !List.of("starting", "running").contains(record.get("state"))))
            throw conflict("The canonical task is no longer active");
        return record;
    }

    public Map<String, Object> book(UUID job) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT seq,plan_sha,envelope::text AS envelope,owner_bucket,priority,attempts,max_attempts,
                       available_at,checkpoint::text AS checkpoint
                FROM ocv_shared1.task_books WHERE job_id=?::uuid FOR UPDATE
                """, job.toString());
        if (rows.size() != 1) throw conflict("The shared task plan has not been prepared");
        return rows.getFirst();
    }

    public void ensureBook(UUID job, Object runId) {
        jdbc.update("""
                INSERT INTO ocv_shared1.task_books(job_id,owner_bucket)
                VALUES(?::uuid,?) ON CONFLICT(job_id) DO NOTHING
                """, job.toString(), String.valueOf(runId));
    }

    public void setPlan(UUID job, Data.Slip slip) {
        jdbc.update("""
                UPDATE ocv_shared1.task_books SET plan_sha=?,envelope=?::jsonb,updated_at=now()
                WHERE job_id=?::uuid AND plan_sha IS NULL
                """, slip.digest(), Fold.write(slip, json), job.toString());
        for (Data.Item row : slip.items())
            jdbc.update("""
                    INSERT INTO ocv_shared1.cash_book(job_id,step_key,ordinal,status)
                    VALUES(?::uuid,?,?,'pending') ON CONFLICT(job_id,step_key) DO NOTHING
                    """, job.toString(), row.key(), row.phase());
        for (Data.Item row : slip.items())
            for (String dependency : row.depends())
                jdbc.update("""
                        INSERT INTO ocv_shared1.order_items(job_id,step_key,depends_on)
                        VALUES(?::uuid,?,?) ON CONFLICT DO NOTHING
                        """, job.toString(), row.key(), dependency);
    }

    public List<Map<String, Object>> steps(UUID job) {
        return jdbc.queryForList("""
                SELECT c.step_key,c.ordinal,c.status,c.attempts,c.lease_owner,c.result_sha,c.result::text AS result,
                       c.updated_at,(SELECT COALESCE(jsonb_agg(o.depends_on ORDER BY o.depends_on),'[]'::jsonb)::text
                            FROM ocv_shared1.order_items o WHERE o.job_id=c.job_id AND o.step_key=c.step_key) AS dependencies,
                       (SELECT count(*) FROM ocv_shared1.order_items o
                            LEFT JOIN ocv_shared1.cash_book prerequisite
                              ON prerequisite.job_id=o.job_id AND prerequisite.step_key=o.depends_on
                            WHERE o.job_id=c.job_id AND o.step_key=c.step_key
                              AND COALESCE(prerequisite.status,'missing')<>'done') AS blocked
                FROM ocv_shared1.cash_book c
                JOIN ocv_shared1.cash_book again ON again.job_id=c.job_id AND again.step_key=c.step_key
                WHERE c.job_id=?::uuid ORDER BY c.ordinal
                """, job.toString());
    }

    public Map<String, Object> step(UUID job, String step) {
        return steps(job).stream().filter(row -> step.equals(row.get("step_key"))).findFirst()
                .orElseThrow(() -> conflict("The requested task step is unavailable"));
    }

    public void begin(UUID job, UUID owner, String step, int attempt) {
        String started = Data.canonical(Map.of("startedAttempt", attempt), json, 1024);
        int changed = jdbc.update("""
                UPDATE ocv_shared1.cash_book SET status='running',attempts=attempts+1,lease_owner=?,result=?::jsonb,
                       result_sha=NULL,updated_at=now()
                WHERE job_id=?::uuid AND step_key=? AND status IN('pending','failed') AND attempts<3
                """, owner, started, job.toString(), step);
        if (changed != 1) throw conflict("The task step exhausted its bounded attempts");
    }

    public void complete(UUID job, UUID owner, String step, String canonical, String digest) {
        int changed = jdbc.update("""
                UPDATE ocv_shared1.cash_book SET status='done',result=?::jsonb,result_sha=?,updated_at=now()
                WHERE job_id=?::uuid AND step_key=? AND status='running' AND lease_owner=?
                """, canonical, digest, job.toString(), step, owner);
        if (changed != 1) throw conflict("Only the current started step can be checkpointed");
    }

    public int resetInterrupted(UUID job, UUID owner, int attempt) {
        return jdbc.update("""
                UPDATE ocv_shared1.cash_book SET status='pending',lease_owner=NULL,updated_at=now()
                WHERE job_id=?::uuid AND status='running' AND (lease_owner IS DISTINCT FROM ?
                      OR COALESCE((result->>'startedAttempt')::integer,0)<?)
                """, job.toString(), owner, attempt);
    }

    public void fail(UUID job, UUID owner, String step, String code, int attempt) {
        String failure = Data.canonical(Map.of("code", code, "attempt", attempt), json, 1024);
        int changed = jdbc.update("""
                UPDATE ocv_shared1.cash_book SET status='failed',result=?::jsonb,result_sha=NULL,updated_at=now()
                WHERE job_id=?::uuid AND step_key=? AND status='running' AND lease_owner=?
                """, failure, job.toString(), step, owner);
        if (changed != 1) throw conflict("Only the current running step can record failure");
    }

    public void checkpoint(UUID job, Data.Slip slip) {
        List<Map<String, Object>> rows = steps(job);
        List<Map<String, Object>> summaries = new ArrayList<>();
        int complete = 0;
        for (Map<String, Object> row : rows) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("step", row.get("step_key"));
            entry.put("phase", row.get("ordinal"));
            entry.put("status", row.get("status"));
            entry.put("sha", Objects.toString(row.get("result_sha"), ""));
            summaries.add(entry);
            if ("done".equals(row.get("status"))) complete++;
        }
        String text = Data.canonical(Map.of("schema", "ocv.task-checkpoint/1", "planSha", slip.digest(),
                "steps", summaries, "complete", complete, "total", slip.items().size()), json, 24576);
        jdbc.update("UPDATE ocv_shared1.task_books SET checkpoint=?::jsonb,updated_at=now() WHERE job_id=?::uuid",
                text, job.toString());
    }

    public long event(UUID job, String key, String kind, Map<String, Object> payload) {
        String text = Data.canonical(payload, json, 16384);
        String digest = Data.sha(text);
        List<Map<String, Object>> duplicate = jdbc.queryForList(
                "SELECT seq,payload_sha FROM ocv_shared1.dispatch_outbox WHERE job_id=?::uuid AND event_key=?",
                job.toString(), key);
        if (!duplicate.isEmpty()) {
            if (!digest.equals(duplicate.getFirst().get("payload_sha"))) throw conflict("Conflicting outbox event replay");
            return ((Number) duplicate.getFirst().get("seq")).longValue();
        }
        Integer size = jdbc.queryForObject("SELECT count(*) FROM ocv_shared1.dispatch_outbox WHERE job_id=?::uuid",
                Integer.class, job.toString());
        if (size != null && size >= 64) throw conflict("The bounded task outbox is full");
        Long serial = jdbc.queryForObject("""
                INSERT INTO ocv_shared1.dispatch_outbox(job_id,event_key,kind,payload,payload_sha)
                VALUES(?::uuid,?,?,?::jsonb,?) RETURNING seq
                """, Long.class, job.toString(), key, kind, text, digest);
        return Objects.requireNonNull(serial);
    }

    public List<Map<String, Object>> messages(UUID job, int maximum) {
        // The stored read order is backwards; the relay adapter restores its public ordinal order.
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT seq,job_id,event_key,kind,payload::text AS payload,payload_sha,delivery,attempts
                FROM (SELECT * FROM ocv_shared1.dispatch_outbox
                      WHERE job_id=?::uuid AND delivery='pending' AND available_at<=now()
                      ORDER BY seq LIMIT ?) stock ORDER BY seq DESC
                """, job.toString(), maximum);
        rows.sort(java.util.Comparator.comparingLong(row -> ((Number) row.get("seq")).longValue()));
        return rows;
    }

    public Map<String, Object> message(long seq) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT seq,job_id,event_key,kind,payload::text AS payload,payload_sha,delivery,attempts
                FROM ocv_shared1.dispatch_outbox WHERE seq=? FOR UPDATE
                """, seq);
        if (rows.size() != 1) throw conflict("Outbox item has expired");
        return rows.getFirst();
    }

    public boolean acknowledge(Map<String, Object> row, String transport) {
        long seq = ((Number) row.get("seq")).longValue();
        String envelope = String.valueOf(row.get("payload"));
        Object reconstructed = object(envelope);
        String digest = Data.sha(Data.canonical(reconstructed, json, 16384));
        if (!digest.equals(row.get("payload_sha"))) throw conflict("Outbox content checksum mismatch");
        int created = jdbc.update("""
                INSERT INTO ocv_shared1.delivery_inbox(event_seq,job_id,payload_sha,envelope,transport)
                VALUES(?,?::uuid,?,?::jsonb,?) ON CONFLICT(event_seq) DO NOTHING
                """, seq, row.get("job_id").toString(), digest, envelope, transport);
        String stored = jdbc.queryForObject("SELECT payload_sha FROM ocv_shared1.delivery_inbox WHERE event_seq=?",
                String.class, seq);
        if (!digest.equals(stored)) throw conflict("Inbox event conflicts with its outbox");
        jdbc.update("UPDATE ocv_shared1.dispatch_outbox SET delivery='delivered',acked_at=now() WHERE seq=?", seq);
        return created == 0;
    }

    public void dispatched(long seq) {
        int changed = jdbc.update("""
                UPDATE ocv_shared1.dispatch_outbox SET attempts=attempts+1,available_at=now()+interval '2 seconds'
                WHERE seq=? AND delivery='pending' AND attempts<8
                """, seq);
        if (changed != 1) throw conflict("Outbox dispatch attempts exhausted");
    }

    public Object object(String source) {
        try { return json.readValue(source, Object.class); }
        catch (Exception failure) { throw conflict("Stored task JSON is unavailable"); }
    }
}
