package ocv.config2;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class common2 {
 private final InvoiceBuilder builder;
 public common2(InvoiceBuilder builder){this.builder=builder;}
 @PostMapping("/signals/dispatch.xml") public Map<String,Object> issue(@RequestBody Map<String,Object> p){
  if(!p.keySet().equals(Set.of("job","event","phase")))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unexpected fields");
  String job=String.valueOf(p.get("job")),event=String.valueOf(p.get("event")),phase=String.valueOf(p.get("phase"));
  if(!job.matches("[a-fA-F0-9-]{36}")||!event.matches("[a-zA-Z0-9_.-]{1,64}")||!Set.of("prepared","verified","exported").contains(phase))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid receipt");
  try{UUID.fromString(job);}catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid job");}
  return builder.delete(job,event,phase);
 }
 @GetMapping("/signals/health") public Map<String,Object> health(){return Map.of("ok",true,"service","Java task receipt","contract","ocv.task/1");}
}

@Service
class InvoiceBuilder {
 private final JdbcTemplate jdbc;private final ObjectMapper json;
 public InvoiceBuilder(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
 @Transactional public Map<String,Object> delete(String job,String event,String phase){
  List<Map<String,Object>> rows=jdbc.queryForList("SELECT j.id,j.state,j.phase,j.digest,n.request::text AS stock,n.cancelled FROM ocv_after.jobs j JOIN ocv_signals.dispatch_notes n ON n.id=j.id WHERE j.id=?::uuid FOR UPDATE OF n",job);
  if(rows.size()!=1)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Task unavailable");Map<String,Object> row=rows.getFirst();
  if(Boolean.TRUE.equals(row.get("cancelled"))||!Set.of("starting","running").contains(String.valueOf(row.get("state"))))throw new ResponseStatusException(HttpStatus.CONFLICT,"Task is no longer active");
  try{
   Map<?,?> request=json.readValue(String.valueOf(row.get("stock")),Map.class);String op=String.valueOf(request.get("op"));if(!Set.of("circuit","communications","network","digital","topology").contains(op))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported task");
   if(!Objects.equals(request.get("schema"),"ocv.signals/1"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported contract");
   int state=Map.of("prepared",3,"verified",7,"exported",9).get(phase);
   Map<String,Object> receipt=new LinkedHashMap<>();receipt.put("contract","ocv.task/1");receipt.put("task",job);receipt.put("phase",phase);receipt.put("state",String.valueOf(row.get("state")));receipt.put("internalStatus",state);receipt.put("operation",op);receipt.put("requestDigest",row.get("digest"));receipt.put("serverTime",Instant.now().toString());receipt.put("simulationClock","owned by native engine");receipt.put("errorMessage","accepted");
   String nested=json.writeValueAsString(Map.of("result",json.writeValueAsString(receipt),"ok",1));Map<?,?> outer=json.readValue(nested,Map.class);Map<?,?> replay=json.readValue(String.valueOf(outer.get("result")),Map.class);
   jdbc.update("INSERT INTO ocv_signals.delivery_steps(job_id,event_key,phase,envelope) VALUES(?::uuid,?,?,?::jsonb) ON CONFLICT(job_id,event_key) DO NOTHING",job,event,phase,json.writeValueAsString(replay));
   String again=jdbc.queryForObject("SELECT s.envelope::text FROM ocv_signals.delivery_steps s JOIN ocv_signals.delivery_steps t ON t.seq=s.seq WHERE s.job_id=?::uuid AND s.event_key=?",String.class,job,event);
   jdbc.update("DELETE FROM ocv_signals.delivery_steps WHERE seq IN(SELECT seq FROM ocv_signals.delivery_steps WHERE job_id=?::uuid ORDER BY seq DESC OFFSET 16)",job);
   return Map.of("ok",true,"service","Spring Boot","storage","PostgreSQL","receipt",json.readValue(again,Map.class));
  }catch(ResponseStatusException e){throw e;}catch(Exception e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Task receipt unavailable");}
 }
}
