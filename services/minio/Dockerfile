FROM golang:1.24-alpine AS build
ENV CGO_ENABLED=0 GOMAXPROCS=2 GOMEMLIMIT=1536MiB GOCACHE=/ocv-deps/go-build GOMODCACHE=/ocv-deps/go-mod GOBIN=/ocv-deps/bin
RUN --mount=type=cache,id=ocv-go-mod,target=/ocv-deps/go-mod --mount=type=cache,id=ocv-go-build,target=/ocv-deps/go-build go install -p=1 github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z
COPY services/fiber/health/main.go /health.go
RUN --mount=type=cache,id=ocv-go-build,target=/ocv-deps/go-build go build -p=1 -o /ocv-health /health.go
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
ENV GOMEMLIMIT=128MiB GOMAXPROCS=2 MINIO_BROWSER=off MINIO_UPDATE=off MINIO_API_REQUESTS_MAX=4
COPY --from=build /ocv-deps/bin/minio /minio
COPY --from=build /ocv-health /ocv-health
ENTRYPOINT ["/minio"]
