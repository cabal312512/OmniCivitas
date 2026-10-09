FROM gradle:8.14.3-jdk21 AS build
WORKDIR /src
COPY services/site-index services/site-index
COPY config/9 config/9
COPY pcakage/ward13 pcakage/ward13
COPY pinia/price13 pinia/price13
RUN --mount=type=cache,target=/opt/gradle-cache cd services/site-index && GRADLE_USER_HOME=/opt/gradle-cache gradle --no-daemon installDist \
    && mkdir native && cd native && jar xf ../build/install/old-stock/lib/sqlite-jdbc-3.50.3.0.jar org/sqlite/native/Linux-Musl
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S ocv && adduser -S ocv -G ocv && mkdir /data && chown ocv:ocv /data
WORKDIR /opt/site
COPY --from=build /src/services/site-index/build/install/old-stock /opt/site
COPY --from=build /src/services/site-index/native/org/sqlite/native/Linux-Musl /opt/site/native
COPY config/9/registry.json /opt/site/registry.json
ENV JAVA_OPTS="-Xms32m -Xmx160m -XX:MaxMetaspaceSize=96m -XX:ActiveProcessorCount=2" OCV_SITE_CATALOG=/opt/site/registry.json OCV_SITE_INDEX=/data/stock.sqlite
USER ocv
EXPOSE 8093
CMD ["sh", "-c", "export JAVA_OPTS=\"$JAVA_OPTS -Dorg.sqlite.lib.path=/opt/site/native/$(uname -m)\"; exec /opt/site/bin/old-stock"]
