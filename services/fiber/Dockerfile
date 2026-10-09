FROM golang:1.24-alpine AS build
ENV GOCACHE=/ocv-deps/go-build GOMODCACHE=/ocv-deps/go-mod CGO_ENABLED=0
WORKDIR /src
COPY services/fiber ./services/fiber
COPY pinia/stock9 ./pinia/stock9
COPY config/apps/fiber3 ./config/apps/fiber3
WORKDIR /src/services/fiber
RUN go mod tidy && go build -o /button . && go build -o /health ./health
FROM alpine:3.21 AS fiber
COPY --from=build /button /button
COPY --from=build /health /ocv-health
COPY --from=build /src/services/fiber/go.sum /usr/share/ocv/go.sum
COPY docs/licenses/lib-pq-1.10.9.txt /usr/share/ocv/licenses/lib-pq.txt
CMD ["/button"]
FROM otel/opentelemetry-collector-contrib:0.123.0 AS otel
COPY --from=build /health /ocv-health
