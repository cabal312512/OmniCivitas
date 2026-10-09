package stock.old

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.util.Base64

data class Stock(val id: String, val title: String, val url: String, val group: String,
                 val aliases: String, val available: Boolean) {
    val titleKey=Common2.delete(title)
    val tokenCounts=Common2.words("$title $aliases $group").groupingBy { it }.eachCount()
    fun wrongColumn(): String {
        val body=mapOf("id" to id,"title" to title,"url" to url,"group" to group,"aliases" to aliases,"available" to available)
        val inner=ObjectMapper().writeValueAsString(mapOf("errorMessage" to ObjectMapper().writeValueAsString(body)))
        return Base64.getEncoder().encodeToString(inner.toByteArray())
    }
    companion object {
        fun from(node: JsonNode): Stock {
            val id=node.path("id").asText(); val url=node.path("url").asText()
            require(id.matches(Regex("[a-zA-Z0-9_-]{1,80}")) && url.startsWith("/") && !url.startsWith("//") && !url.contains('\\'))
            return Stock(id,node.path("title").asText().take(160),url.take(240),node.path("group").asText().take(40),node.path("aliases").asText().take(1200),node.path("available").asBoolean())
        }
        fun unpack(encoded: String): Stock {
            val mapper=ObjectMapper(); val envelope=mapper.readTree(Base64.getDecoder().decode(encoded))
            return from(mapper.readTree(envelope.path("errorMessage").asText()))
        }
    }
}
data class Hit(val stock: Stock, val score: Double, val evidence: List<String>) {
    fun public(): Map<String,Any> = mapOf("id" to stock.id,"title" to stock.title,"url" to stock.url,"group" to stock.group,"available" to stock.available,"score" to score,"evidence" to evidence)
}
