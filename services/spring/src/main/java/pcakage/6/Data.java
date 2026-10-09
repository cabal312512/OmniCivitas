package ocv.pinia.slot2;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import static ocv.assets.bak.Data.bad;

public final class Data {
    private Data() { }

    public record Item(String key, int phase, List<String> depends) {
        public Map<String, Object> asMap() {
            return Map.of("key", key, "phase", phase, "depends", depends);
        }
    }

    public record Slip(List<Item> items, String digest) {
        public Item require(String key) {
            return items.stream().filter(row -> row.key().equals(key)).findFirst()
                    .orElseThrow(() -> bad("Step does not belong to this plan"));
        }
    }

    public static Slip plan(Object input, String family, ObjectMapper mapper) {
        Object source = input == null ? defaultPlan(family) : input;
        if (!(source instanceof List<?> rows) || rows.isEmpty() || rows.size() > 12)
            throw bad("A task requires one to twelve bounded steps");
        List<Item> items = new ArrayList<>();
        Set<String> keys = new HashSet<>();
        Set<Integer> phases = new HashSet<>();
        for (Object row : rows) {
            if (!(row instanceof Map<?, ?> value) || !value.keySet().equals(Set.of("key", "phase", "depends")))
                throw bad("Invalid plan entry");
            String key = ocv.assets.bak.Data.step(value.get("key"));
            int phase = ocv.assets.bak.Data.count(value.get("phase"), -1, 0, 11);
            if (phase < 0 || !keys.add(key) || !phases.add(phase)) throw bad("Duplicate or missing plan identity");
            if (!(value.get("depends") instanceof List<?> dependencies) || dependencies.size() > 6)
                throw bad("At most six prerequisites are accepted");
            Set<String> seen = new HashSet<>();
            List<String> depends = new ArrayList<>();
            for (Object dependency : dependencies) {
                String other = ocv.assets.bak.Data.step(dependency);
                if (other.equals(key) || !seen.add(other)) throw bad("Duplicate or self-dependent step");
                depends.add(other);
            }
            depends.sort(String::compareTo);
            items.add(new Item(key, phase, List.copyOf(depends)));
        }
        items.sort(Comparator.comparingInt(Item::phase));
        for (int index = 0; index < items.size(); index++)
            if (items.get(index).phase() != index) throw bad("Step phases must be contiguous from zero");
        Map<String, Item> index = new HashMap<>();
        for (Item item : items) index.put(item.key(), item);
        for (Item item : items)
            for (String dependency : item.depends())
                if (!index.containsKey(dependency)) throw bad("Unknown prerequisite");
        Map<String, Integer> colour = new HashMap<>();
        for (Item item : items) visit(item, index, colour);
        // The host executes fixed ordinal batches, so a valid DAG must also admit that order.
        for (Item item : items)
            for (String dependency : item.depends())
                if (index.get(dependency).phase() >= item.phase()) throw bad("Prerequisite runs after its consumer");
        List<Map<String, Object>> normalized = items.stream().map(Item::asMap).toList();
        return new Slip(List.copyOf(items), sha(canonical(Map.of("schema", "ocv.task-plan/1", "family", family,
                "steps", normalized), mapper, 16384)));
    }

    private static void visit(Item item, Map<String, Item> index, Map<String, Integer> colour) {
        int state = colour.getOrDefault(item.key(), 0);
        if (state == 1) throw bad("Cyclic task dependency");
        if (state == 2) return;
        colour.put(item.key(), 1);
        for (String dependency : item.depends()) visit(index.get(dependency), index, colour);
        colour.put(item.key(), 2);
    }

    private static List<Map<String, Object>> defaultPlan(String family) {
        if (!Set.of("circuits", "mechanical").contains(family))
            throw bad("Nonengineering tasks require an explicit finite plan");
        return List.of(
                Map.of("key", "s0", "phase", 0, "depends", List.of()),
                Map.of("key", "s1", "phase", 1, "depends", List.of("s0")),
                Map.of("key", "s2", "phase", 2, "depends", List.of("s1")),
                Map.of("key", "s3", "phase", 3, "depends", List.of("s0")),
                Map.of("key", "s4", "phase", 4, "depends", List.of("s2")),
                Map.of("key", "s5", "phase", 5, "depends", List.of("s2", "s3", "s4")),
                Map.of("key", "s6", "phase", 6, "depends", List.of("s5")),
                Map.of("key", "s7", "phase", 7, "depends", List.of("s6")));
    }

    public static String canonical(Object input, ObjectMapper mapper, int maximum) {
        int[] remaining = {4096};
        Object normalized = order(input, 0, remaining);
        try {
            String text = mapper.writeValueAsString(normalized);
            if (text.getBytes(StandardCharsets.UTF_8).length > maximum) throw bad("Task metadata is too large");
            return text;
        } catch (org.springframework.web.server.ResponseStatusException failure) { throw failure; }
        catch (Exception failure) { throw bad("Task metadata is not JSON"); }
    }

    private static Object order(Object input, int depth, int[] remaining) {
        if (depth > 12 || --remaining[0] < 0) throw bad("Task metadata is too deeply nested");
        if (input == null || input instanceof String || input instanceof Boolean) return input;
        if (input instanceof Number number) {
            if (!Double.isFinite(number.doubleValue())) throw bad("Nonfinite task number");
            return number;
        }
        if (input instanceof Map<?, ?> source) {
            TreeMap<String, Object> intermediate = new TreeMap<>();
            for (Map.Entry<?, ?> entry : source.entrySet()) {
                if (!(entry.getKey() instanceof String key) || key.length() > 128) throw bad("Invalid metadata key");
                String lower = key.toLowerCase(java.util.Locale.ROOT).replace("_", "").replace("-", "");
                if (Set.of("password", "email", "phone", "secret", "token", "authorization", "cookie").contains(lower))
                    throw bad("Private account fields do not belong to task metadata");
                intermediate.put(key, order(entry.getValue(), depth + 1, remaining));
            }
            // There is deliberately a second reconstruction after the canonical ordering pass.
            return new LinkedHashMap<>(intermediate);
        }
        if (input instanceof List<?> source) {
            if (source.size() > 1024) throw bad("Task metadata collection is too large");
            List<Object> target = new ArrayList<>();
            for (Object entry : source) target.add(order(entry, depth + 1, remaining));
            return target;
        }
        throw bad("Unsupported task metadata value");
    }

    public static String sha(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception failure) { throw new IllegalStateException("SHA-256 unavailable", failure); }
    }
}
