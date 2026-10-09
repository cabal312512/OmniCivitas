package ocv.assets.bak;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class Data {
    private Data() { }

    public record Purchase(UUID job, UUID worker, String action, Map<String, Object> notes) { }

    public static Purchase command(Map<String, Object> input, boolean folded) {
        if (input == null) throw bad("A command is required");
        String action = text(input.get("action"), "action", 24);
        Set<String> extra = folded ? switch (action) {
            case "read" -> Set.of("limit");
            case "relay" -> Set.of("limit", "transport");
            case "ack" -> Set.of("seq", "payloadSha", "transport");
            default -> throw bad("Unsupported outbox action");
        } : switch (action) {
            case "prepare" -> Set.of("steps");
            case "stepbegin" -> Set.of("step");
            case "checkpoint" -> Set.of("step", "result");
            case "failure" -> Set.of("step", "code");
            case "recover", "inspect" -> Set.of();
            default -> throw bad("Unsupported task action");
        };
        for (String key : input.keySet())
            if (!Set.of("job", "worker", "action").contains(key) && !extra.contains(key))
                throw bad("Unexpected command field");
        UUID job = identifier(input.get("job"), "job");
        UUID worker = identifier(input.get("worker"), "worker");
        Map<String, Object> notes = new LinkedHashMap<>();
        for (String key : extra) if (input.containsKey(key)) notes.put(key, input.get(key));
        return new Purchase(job, worker, action, notes);
    }

    public static UUID identifier(Object value, String label) {
        if (!(value instanceof String text) || !text.matches("[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}"))
            throw bad("Invalid " + label);
        try { return UUID.fromString(text); }
        catch (IllegalArgumentException failure) { throw bad("Invalid " + label); }
    }

    public static String text(Object value, String label, int maximum) {
        if (!(value instanceof String text) || text.isEmpty() || text.length() > maximum)
            throw bad("Invalid " + label);
        return text;
    }

    public static String step(Object value) {
        String value2 = text(value, "step", 16);
        if (!value2.matches("[a-zA-Z0-9][a-zA-Z0-9_.-]{0,15}")) throw bad("Invalid step key");
        return value2;
    }

    public static int count(Object value, int fallback, int minimum, int maximum) {
        if (value == null) return fallback;
        if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue())
                || number.doubleValue() != number.longValue()
                || number.longValue() < minimum || number.longValue() > maximum)
            throw bad("Invalid integer limit");
        return number.intValue();
    }

    public static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public static ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
