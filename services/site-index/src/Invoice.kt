package stock.old

import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.application.*
import io.ktor.server.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.http.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.serialization.jackson.*
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import kotlin.math.ln

class InvoiceBuilder(private val cabinet: Warehouse) {
    private val memo=object:LinkedHashMap<String,Pair<Long,Map<String,Any>>>(64,.75f,true){override fun removeEldestEntry(eldest:MutableMap.MutableEntry<String,Pair<Long,Map<String,Any>>>?)=size>64}
    private val documentFrequency=cabinet.records.flatMap{it.tokenCounts.keys}.groupingBy{it}.eachCount()
    @Synchronized fun restore(request: JsonNode): Map<String,Any> {
        require(request.isObject && request.path("schema").isTextual && request.path("query").isTextual)
        require(request.path("schema").asText()=="ocv.site-index/1")
        require(request.fieldNames().asSequence().all{it in setOf("schema","query","limit","group","from","to")})
        if(request.has("limit"))require(request.path("limit").isIntegralNumber && request.path("limit").canConvertToInt())
        for(field in listOf("group","from","to"))if(request.has(field))require(request.path(field).isTextual)
        val query=request.path("query").asText(); require(query.length<=80 && query.none{it.code<32})
        val limit=request.path("limit").asInt(12);require(limit in 1..20)
        val group=request.path("group").asText();require(group.length<=40)
        val from=request.path("from").asText("/");val to=request.path("to").asText();require(from.length<=240&&to.length<=240)
        val cacheKey=Common2.sha(ObjectMapper().writeValueAsString(request)+cabinet.digest)
        val old=memo[cacheKey];if(old!=null&&System.currentTimeMillis()-old.first<60000)return old.second+mapOf("cache" to "memory+SQLite-revision", "readback" to cabinet.evidence())
        val clean=Common2.delete(query);val terms=Common2.words(query)
        val (records,fts)=cabinet.candidates(terms)
        val hits=records.asSequence().filter{it.available&&(group.isEmpty()||it.group==group)}.map{stock->
            val evidence=mutableListOf<String>();var score=0.0
            if(clean.isEmpty()){score=1.0;if(stock.group=="推荐")score+=8}
            if(clean.isNotEmpty()&&stock.titleKey==clean){score+=120;evidence.add("exact-title")}
            if(clean.isNotEmpty()&&stock.titleKey.contains(clean)){score+=42;evidence.add("title-substring")}
            if(clean.isNotEmpty()&&Common2.delete(stock.aliases).contains(clean)){score+=22;evidence.add("alias")}
            for(term in terms){val frequency=stock.tokenCounts[term]?:0;if(frequency>0){val idf=ln(1+(cabinet.records.size-(documentFrequency[term]?:0)+.5)/((documentFrequency[term]?:0)+.5));score+=idf*frequency*2.2/(frequency+1.2);evidence.add("term")}
                else if(stock.tokenCounts.keys.any{it.startsWith(term)}){score+=3;evidence.add("prefix")}}
            if(score==0.0&&clean.length in 3..32&&stock.tokenCounts.keys.any{it.length in 3..32&&Common2.distance(clean,it,2)<=2}){score=1.5;evidence.add("edit-distance")}
            Hit(stock,score,evidence.distinct())
        }.filter{it.score>0}.sortedWith(compareByDescending<Hit>{it.score}.thenBy{it.stock.id}).take(limit).toList()
        val answer=mapOf<String,Any>("schema" to "ocv.site-index/1","ok" to true,"engine" to "Kotlin/Ktor","hits" to hits.map{it.public()},"path" to cabinet.path(from,to.ifEmpty{hits.firstOrNull()?.stock?.url?.substringBefore('#')?:"/"}),"readback" to cabinet.evidence(),"ftsCandidates" to fts,"cache" to "miss","queryPersisted" to false)
        memo[cacheKey]=System.currentTimeMillis() to answer
        return answer
    }
}
fun main(){
    val cabinet=Warehouse();val invoice=InvoiceBuilder(cabinet)
    embeddedServer(Netty,port=8093,host="0.0.0.0"){
        install(ContentNegotiation){jackson()}
        routing {
            get("/health"){call.respond(cabinet.evidence()+mapOf("ok" to true))}
            post("/api/foo.aspx"){
                try{val text=call.receiveText();require(text.toByteArray().size<=4096);call.respond(invoice.restore(ObjectMapper().readTree(text)))}
                catch(error:Exception){call.respond(HttpStatusCode.BadRequest,mapOf("ok" to false,"code" to "invalid_index_request"))}
            }
        }
    }.start(wait=true)
}
