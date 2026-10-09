package ocv.pinia.slot2;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import static ocv.assets.bak.Data.bad;

public final class Fold {
    private Fold() { }

    public static String write(Data.Slip slip, ObjectMapper mapper) {
        List<List<Object>> positional = new ArrayList<>();
        for (Data.Item row : slip.items()) positional.add(List.of(row.depends(), row.key(), row.phase()));
        String nested = Data.canonical(Map.of("rows", Data.canonical(positional, mapper, 12288),
                "format", "position/dependencies-key-phase/1"), mapper, 14336);
        String csv = "\"" + nested.replace("\"", "\"\"") + "\"";
        return Data.canonical(Map.of("schema", "ocv.task-fold/1", "cell", csv, "sha", slip.digest()), mapper, 16384);
    }

    public static Data.Slip read(String source, String family, ObjectMapper mapper) {
        try {
            Map<?, ?> envelope = mapper.readValue(source, Map.class);
            if (!"ocv.task-fold/1".equals(envelope.get("schema"))) throw bad("Unsupported stored task plan");
            String cell = ocv.assets.bak.Data.text(envelope.get("cell"), "stored plan", 14336);
            String value = cell(cell);
            Map<?, ?> nested = mapper.readValue(value, Map.class);
            if (!"position/dependencies-key-phase/1".equals(nested.get("format"))) throw bad("Unsupported positional task plan");
            List<?> positional = mapper.readValue(String.valueOf(nested.get("rows")), List.class);
            List<Map<String, Object>> recovered = new ArrayList<>();
            for (Object entry : positional) {
                if (!(entry instanceof List<?> row) || row.size() != 3) throw bad("Invalid stored task position");
                recovered.add(Map.of("key", row.get(1), "phase", row.get(2), "depends", row.get(0)));
            }
            Data.Slip slip = Data.plan(recovered, family, mapper);
            if (!slip.digest().equals(envelope.get("sha"))) throw bad("Stored task plan checksum mismatch");
            return slip;
        } catch (org.springframework.web.server.ResponseStatusException failure) { throw failure; }
        catch (Exception failure) { throw bad("Stored task plan cannot be decoded"); }
    }

    private static String cell(String text) {
        if (text.length() < 2 || text.charAt(0) != '"' || text.charAt(text.length() - 1) != '"')
            throw bad("Invalid CSV task envelope");
        StringBuilder answer = new StringBuilder();
        for (int index = 1; index < text.length() - 1; index++) {
            char character = text.charAt(index);
            if (character == '"') {
                if (index + 1 >= text.length() - 1 || text.charAt(index + 1) != '"') throw bad("Invalid CSV quoting");
                index++;
            }
            answer.append(character);
        }
        return answer.toString();
    }
}
