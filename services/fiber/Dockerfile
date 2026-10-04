FROM golang:1.24-alpine AS build
ENV GOCACHE=/ocv-deps/go-build GOMODCACHE=/ocv-deps/go-mod CGO_ENABLED=0
WORKDIR /src
COPY services/fiber ./
RUN go mod tidy && go build -o /button . && go build -o /health ./health
FROM alpine:3.21 AS fiber
COPY --from=build /button /button
COPY --from=build /health /ocv-health
CMD ["/button"]
FROM otel/opentelemetry-collector-contrib:0.123.0 AS otel
COPY --from=build /health /ocv-health
