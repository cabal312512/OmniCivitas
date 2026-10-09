package ocv.assets.bak;

import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class cache {
    private final ocv.pinia.slot2.common2 invoices;
    private final String runner;

    public cache(ocv.pinia.slot2.common2 invoices, @Value("${OCV_RUNNER_KEY:}") String runner) {
        this.invoices = invoices;
        this.runner = runner;
    }

    @PostMapping("/shared/invoice.php")
    public Map<String, Object> delete(@RequestHeader(value = "X-Ocv-Runner", required = false) String key,
                                      @RequestBody Map<String, Object> envelope) {
        privateInvoice(key);
        return invoices.delete(Data.command(envelope, false));
    }

    @PostMapping("/shared/outbox.asm")
    public Map<String, Object> restore(@RequestHeader(value = "X-Ocv-Runner", required = false) String key,
                                       @RequestBody Map<String, Object> envelope) {
        privateInvoice(key);
        return invoices.restore(Data.command(envelope, true));
    }

    private void privateInvoice(String key) {
        if (!runner.matches("[a-f0-9]{64}") || key == null || !key.matches("[a-f0-9]{64}")
                || !MessageDigest.isEqual(runner.getBytes(StandardCharsets.US_ASCII), key.getBytes(StandardCharsets.US_ASCII)))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task endpoint is unavailable");
    }

    @GetMapping("/shared/tasks/health")
    public Map<String, Object> health() {
        return Map.of("ok", true, "contract", "ocv.shared-task/1", "authority", "ocv_after.jobs",
                "dispatcher", "existing leased host runner", "backgroundScheduler", false);
    }
}
