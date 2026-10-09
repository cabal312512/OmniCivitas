package stock.old

import java.text.Normalizer
import java.security.MessageDigest
import kotlin.math.min

object Common2 {
    fun delete(value: String): String = Normalizer.normalize(value, Normalizer.Form.NFKC).lowercase().trim()
    fun sha(value: String): String = MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    fun words(value: String): List<String> {
        val clean = delete(value)
        val terms = Regex("[a-z0-9_-]+|[\\p{IsHan}\\p{IsHiragana}\\p{IsKatakana}\\p{IsHangul}]+").findAll(clean).flatMap { match ->
            val text = match.value
            if (text.any { it.code > 127 }) sequenceOf(text) + text.windowed(2).asSequence()
            else sequenceOf(text)
        }.toList()
        return terms.distinct().take(160)
    }
    fun distance(a: String, b: String, limit: Int = 3): Int {
        if (kotlin.math.abs(a.length-b.length)>limit) return limit+1
        var row = IntArray(b.length+1) { it }
        for ((i,c) in a.withIndex()) {
            val next=IntArray(b.length+1); next[0]=i+1
            for (j in b.indices) next[j+1]=min(min(next[j]+1,row[j+1]+1),row[j]+if(c==b[j])0 else 1)
            row=next
        }
        return row.last()
    }
}
