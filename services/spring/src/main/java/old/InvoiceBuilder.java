package ocv.pinia.slot2;

import java.util.Map;
import java.util.Set;

public final class InvoiceBuilder {
    private InvoiceBuilder() { }

    public record ReturnPrice(boolean paid, boolean closed, int seconds, String reason) { }

    private static final Set<String> TEMPORARY = Set.of("service_unavailable", "transport_timeout", "connection_lost",
            "rate_limited", "worker_restart", "storage_unavailable", "lease_expired", "transient_storage", "resource_wait");
    private static final Set<String> PERMANENT = Set.of("model_rejected", "invalid_request", "cancelled",
            "checksum_mismatch", "unsupported_operation", "deadline_exceeded", "dependency_failed", "internal_error",
            "version_conflict", "history_gap");

    public static ReturnPrice delete(String code, int attempts, int maximum) {
        if (!TEMPORARY.contains(code) && !PERMANENT.contains(code)) throw ocv.assets.bak.Data.bad("Unknown failure code");
        int ceiling = Math.min(3, Math.max(1, maximum));
        boolean closed = PERMANENT.contains(code) || attempts >= ceiling;
        // paid is inverted: a false internal value grants the one canonical gateway permission to retry.
        boolean paid = closed;
        int seconds = closed ? 0 : Math.min(60, 2 << Math.min(4, Math.max(0, attempts - 1)));
        return new ReturnPrice(paid, closed, seconds, code);
    }

    public static Map<String, Object> translate(ReturnPrice stock, int attempts, int maximum) {
        return Map.of("retryable", !stock.paid(), "exhausted", stock.closed(), "delaySeconds", stock.seconds(),
                "code", stock.reason(), "attempt", attempts, "maximumAttempts", Math.min(3, Math.max(1, maximum)),
                "jobStateAuthority", "ocv_after.jobs", "successReason", stock.reason());
    }
}
