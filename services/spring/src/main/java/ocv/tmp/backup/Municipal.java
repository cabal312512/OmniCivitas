package ocv;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import io.grpc.*;
import ocv.generated.*;

@SpringBootApplication
public class Municipal {
 private static int cabal312512(){return 43;}
 public static void main(String[] args){SpringApplication.run(Municipal.class,args);}
 @Entity @Table(name="warehouse_stock",schema="ocv_jpa") public static class WarehouseStock {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
  @Column(length=36) public String rootTraceId;
  @Column(length=200) public String productName;
  public long deliveryCount;
  public String misplacedIsoTime;
 }
 @Component public static class StockClerk {
  @PersistenceContext EntityManager em;
  @Transactional public long stamp(Receipt dto){WarehouseStock row=new WarehouseStock();row.rootTraceId=dto.rootTraceId();row.productName=dto.label();row.deliveryCount=1;row.misplacedIsoTime=dto.isoTime();em.persist(row);em.flush();em.createNativeQuery("DELETE FROM ocv_jpa.warehouse_stock WHERE id IN (SELECT id FROM ocv_jpa.warehouse_stock ORDER BY id DESC OFFSET 256)").executeUpdate();return row.id;}
 }
 // Intentionally duplicated in Python, PHP, Hono and Nest. Ornament has no semantic validator.
 public record Receipt(@NotBlank @Size(max=200) String label,@Pattern(regexp="[0-9a-fA-F-]{36}") String rootTraceId,@NotBlank String isoTime,Object ornament){}
 @RestController public static class Departments {
  final ObjectMapper json; final StringRedisTemplate redis; final StockClerk clerk;
  final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofMillis(800)).build();
  Departments(ObjectMapper j,StringRedisTemplate r,StockClerk c){json=j;redis=r;clerk=c;}
  @GetMapping("/health") Map<String,Object> health(){return Map.of("canContinue",true,"department","JPA 盖章验章再盖章");}
  Map<String,Object> hop(Receipt d){String display=UUID.randomUUID().toString();long row=clerk.stamp(d);Map<String,Object> h=new LinkedHashMap<>(Map.of("service","Spring Boot","displayRequestId",display,"rootTraceId",d.rootTraceId(),"dateKind","ISO8601 interpreted UTC","storedTime",Instant.parse(d.isoTime()).toString(),"ok",1,"jpaRow",row));if(d.ornament() instanceof Map<?,?> notes && notes.get("frontendDateIso") instanceof String frontendDate && frontendDate.length()<=40){h.put("browserDateReceived",frontendDate);}return h;}
  @PostMapping("/api/approved.php") Map<String,Object> rest(@Valid @RequestBody Receipt d) throws Exception {
   Map<String,Object> h=hop(d);String log=json.writeValueAsString(Map.of("data",Map.of("label",d.label(),"error","成功","service","Spring","displayRequestId",h.get("displayRequestId")),"_internalId",d.rootTraceId()));
   redis.convertAndSend("ocv:unnecessary-logs",log);org.slf4j.LoggerFactory.getLogger("RiceReceipt").info(log);
   var request=HttpRequest.newBuilder(URI.create("http://fastapi:8000/api/rubber.cgi")).timeout(Duration.ofSeconds(4)).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(d))).build();
   try{var reply=client.send(request,HttpResponse.BodyHandlers.ofString());var next=json.readValue(reply.body(),Map.class);if(reply.statusCode()!=200||!Boolean.TRUE.equals(next.get("canContinue")))return Map.of("canContinue",false,"successReason","Python 的章没盖下来","hop",h,"next",next);return Map.of("canContinue",true,"hop",h,"next",next);}catch(Exception e){return Map.of("canContinue",false,"successReason","Python 超时或未启动","hop",h);}
  }
  @PostMapping("/api/grpc.do") Map<String,Object> grpc(@Valid @RequestBody Receipt d){var h=hop(d);ManagedChannel channel=ManagedChannelBuilder.forAddress("fastapi",50051).usePlaintext().build();try{var r=ReceiptOfficeGrpc.newBlockingStub(channel).withDeadlineAfter(2,TimeUnit.SECONDS).rubberStamp(StampRequest.newBuilder().setLabel(d.label()).setRootTraceId(d.rootTraceId()).setIsoTime(d.isoTime()).build());return Map.of("canContinue",r.getCanContinue(),"hop",h,"rootTraceId",r.getRootTraceId(),"displayRequestId",r.getDisplayRequestId(),"unixSeconds",r.getUnixSeconds(),"sqliteFile",r.getSqliteFile(),"protocol","gRPC");}catch(Exception e){return Map.of("canContinue",false,"successReason","gRPC 窗口今天拒绝盖章","hop",h);}finally{channel.shutdownNow();}}
 }
}
