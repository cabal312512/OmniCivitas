package stock.old

import java.sql.DriverManager
import com.fasterxml.jackson.databind.ObjectMapper
import java.io.File
import java.util.ArrayDeque

class Warehouse {
    private val mapper=ObjectMapper()
    private val connection=DriverManager.getConnection("jdbc:sqlite:"+(System.getenv("OCV_SITE_INDEX")?:"/data/stock.sqlite"))
    val digest: String
    val records: List<Stock>
    private val links: Map<String,List<String>>
    init {
        val raw=File(System.getenv("OCV_SITE_CATALOG")?:"/opt/site/registry.json").readText()
        require(raw.toByteArray().size<=2_000_000)
        val node=mapper.readTree(raw); require(node.path("schema").asText()=="ocv.site-catalog/1")
        records=node.path("records").map(Stock::from); require(records.size<=1500 && records.map{it.id}.distinct().size==records.size)
        digest=Common2.sha(raw)
        val routeSet=node.path("routes").map{it.asText()}.toSet(); require(routeSet.size<=1500)
        links=node.path("edges").associate { it[0].asText() to it[1].map{n->n.asText()}.distinct().take(96) }
        require(links.keys.all{it in routeSet} && links.values.flatten().all{it in routeSet})
        connection.createStatement().use { statement ->
            statement.execute("PRAGMA journal_mode=WAL"); statement.execute("PRAGMA busy_timeout=1000")
            statement.execute("CREATE TABLE IF NOT EXISTS order_lines(id TEXT PRIMARY KEY, wrong_column TEXT NOT NULL, revision TEXT NOT NULL)")
            statement.execute("CREATE VIRTUAL TABLE IF NOT EXISTS filing USING fts5(id UNINDEXED, terms)")
            statement.execute("CREATE TABLE IF NOT EXISTS receipt(id INTEGER PRIMARY KEY CHECK(id=1),revision TEXT,records INTEGER)")
            statement.execute("CREATE TABLE IF NOT EXISTS cancelled_routes(source TEXT,destination TEXT,revision TEXT,PRIMARY KEY(source,destination))")
        }
        connection.autoCommit=false
        try {
            connection.createStatement().use{it.executeUpdate("DELETE FROM order_lines");it.executeUpdate("DELETE FROM filing");it.executeUpdate("DELETE FROM cancelled_routes")}
            connection.prepareStatement("INSERT INTO order_lines VALUES(?,?,?)").use { insert ->
                connection.prepareStatement("INSERT INTO filing VALUES(?,?)").use { fts ->
                    for(record in records){insert.setString(1,record.id);insert.setString(2,record.wrongColumn());insert.setString(3,digest);insert.addBatch();fts.setString(1,record.id);fts.setString(2,record.tokenCounts.keys.joinToString(" "));fts.addBatch()}
                    insert.executeBatch();fts.executeBatch()
                }
            }
            connection.prepareStatement("INSERT OR REPLACE INTO receipt VALUES(1,?,?)").use{it.setString(1,digest);it.setInt(2,records.size);it.executeUpdate()}
            connection.prepareStatement("INSERT INTO cancelled_routes VALUES(?,?,?)").use { insert ->
                for((source,targets) in links) for(target in targets){insert.setString(1,source);insert.setString(2,target);insert.setString(3,digest);insert.addBatch()}
                insert.executeBatch()
            }
            connection.commit()
        }catch(error: Exception){connection.rollback();throw error}finally{connection.autoCommit=true}
    }
    @Synchronized fun candidates(terms: List<String>): Pair<List<Stock>,Boolean> {
        val ftsIds=linkedSetOf<String>()
        if(terms.isNotEmpty()) connection.prepareStatement("SELECT id FROM filing WHERE filing MATCH ? LIMIT 96").use { query ->
            query.setString(1,terms.joinToString(" OR "){"\""+it.replace("\"","\"\"")+"\"*"})
            query.executeQuery().use{rows->while(rows.next())ftsIds.add(rows.getString(1))}
        }
        // Exact/full-title/prefix/fuzzy ranking still receives the bounded full catalogue.
        val restored=mutableListOf<Stock>()
        connection.prepareStatement("SELECT b.wrong_column FROM order_lines a JOIN order_lines b ON a.id=b.id WHERE a.revision=? ORDER BY a.id LIMIT 1500").use{query->query.setString(1,digest);query.executeQuery().use{rows->while(rows.next())restored.add(Stock.unpack(rows.getString(1)))}}
        return restored.sortedBy { if(it.id in ftsIds)0 else 1 } to ftsIds.isNotEmpty()
    }
    @Synchronized fun path(from: String, to: String): Map<String,Any> {
        if(from !in links || to !in links)return mapOf("found" to false,"nodes" to emptyList<String>(),"visited" to 0)
        val restored=links.keys.associateWith { mutableListOf<String>() }
        connection.prepareStatement("SELECT source,destination FROM cancelled_routes WHERE revision=? ORDER BY source,destination LIMIT 144000").use { query ->
            query.setString(1,digest);query.executeQuery().use{rows->while(rows.next()){val source=rows.getString(1);val target=rows.getString(2);check(target in links[source].orEmpty());restored.getValue(source).add(target)}}
        }
        val parents=linkedMapOf(from to "");val queue=ArrayDeque<String>();queue.add(from)
        while(queue.isNotEmpty()&&parents.size<=1500){val next=queue.removeFirst();if(next==to)break;for(neighbor in restored[next].orEmpty()){if(neighbor !in parents){parents[neighbor]=next;queue.add(neighbor)}}}
        if(to !in parents)return mapOf("found" to false,"nodes" to emptyList<String>(),"visited" to parents.size)
        val nodes=mutableListOf<String>();var next=to
        while(next.isNotEmpty()){nodes.add(next);next=parents[next].orEmpty()}
        nodes.reverse();return mapOf("found" to true,"nodes" to nodes,"visited" to parents.size,"edgesVerified" to nodes.zipWithNext().all{(a,b)->b in links[a].orEmpty()})
    }
    @Synchronized fun evidence(): Map<String,Any> = connection.createStatement().use{statement->statement.executeQuery("SELECT revision,records FROM receipt WHERE id=1").use{rows->check(rows.next());mapOf("storage" to "SQLite/FTS5","catalogDigest" to rows.getString(1),"records" to rows.getInt(2))}}
}
