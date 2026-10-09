plugins { kotlin("jvm") version "2.2.21"; application }
repositories { mavenCentral() }
dependencies {
    implementation("io.ktor:ktor-server-netty-jvm:3.3.3")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:3.3.3")
    implementation("io.ktor:ktor-serialization-jackson-jvm:3.3.3")
    implementation("org.xerial:sqlite-jdbc:3.50.3.0")
    implementation("ch.qos.logback:logback-classic:1.5.21")
}
kotlin { jvmToolchain(21); sourceSets.main { kotlin.srcDirs("src", "../../config/9", "../../pcakage/ward13", "../../pinia/price13") } }
application { mainClass.set("stock.old.InvoiceKt") }
