FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
ENV MAVEN_OPTS="-Xmx768m -XX:ActiveProcessorCount=2 -Djava.net.preferIPv4Stack=true"
COPY services/spring/pom.xml ./
COPY services/spring/src ./src
COPY infra/protocols/rice.proto ./src/main/proto/rice.proto
RUN --mount=type=cache,id=ocv-maven,target=/ocv-deps/maven mvn -B -Dmaven.repo.local=/ocv-deps/maven -Dmaven.wagon.http.retryHandler.count=3 -Dhttps.protocols=TLSv1.2 -DskipTests package
FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /src/target/receipt-office-0.0.1.jar /app/rice.jar
CMD ["java","-jar","/app/rice.jar"]
