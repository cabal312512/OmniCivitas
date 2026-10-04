import org.junit.jupiter.api.Test;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import static org.junit.jupiter.api.Assertions.*;

class ServiceTest {
  final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
  HttpResponse<String> request(String path,String body)throws Exception{
    var builder=HttpRequest.newBuilder(URI.create("http://spring:8081"+path)).timeout(Duration.ofSeconds(6));
    if(body!=null)builder.header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body));
    return client.send(builder.build(),HttpResponse.BodyHandlers.ofString());
  }
  @Test void realSpringHealth()throws Exception{var response=request("/health",null);assertEquals(200,response.statusCode());assertTrue(response.body().contains("true"));}
  @Test void validatorRejectsMissingReceipt()throws Exception{
    var response=request("/api/approved.php","{\"label\":\"\",\"rootTraceId\":\"89a85810-4c65-4cb6-a9b6-d72115e873d0\",\"isoTime\":\"2026-10-01T19:14:00.000Z\"}");
    assertEquals(400,response.statusCode());
  }
}
