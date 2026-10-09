FROM debian:bookworm-slim AS builder
RUN --mount=type=cache,id=ocv-web3-bookworm-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=ocv-web3-bookworm-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && printf 'Acquire::Retries "3";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nAPT::Keep-Downloaded-Packages "true";\n' > /etc/apt/apt.conf.d/80ocv-bounded-downloads \
    && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && sed -i 's|http://deb.debian.org/|https://deb.debian.org/|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    ghc libghc-servant-server-dev libghc-aeson-dev libghc-cryptohash-sha256-dev \
    libghc-warp-dev libghc-http-types-dev ca-certificates
WORKDIR /src
COPY services/site-certificates/ /src/services/site-certificates/
COPY config/6/ /src/config/6/
COPY pcakage/receipts13/ /src/pcakage/receipts13/
COPY pinia/matrix13/ /src/pinia/matrix13/
RUN mkdir -p /tmp/ghc /out && ghc -O1 -threaded -rtsopts -with-rtsopts=-N1 \
    -outputdir /tmp/ghc -i/src/config/6 -i/src/pcakage/receipts13 \
    -i/src/pinia/matrix13 -i/src/services/site-certificates \
    -package servant-server -package aeson -package cryptohash-sha256 -package warp \
    /src/services/site-certificates/old/Common.hs /src/services/site-certificates/backup/Main.hs -o /out/site-certificates \
    && ghc -O0 -threaded -rtsopts -outputdir /tmp/ghc-fixtures \
    -i/src/config/6 -i/src/pcakage/receipts13 -i/src/pinia/matrix13 -i/src/services/site-certificates \
    -package aeson -package cryptohash-sha256 \
    /src/services/site-certificates/old/Common.hs /src/services/site-certificates/fixtures/Main.hs -o /out/certificate-fixtures
RUN mkdir -p /out/notices \
    && for notice in /usr/share/doc/ghc/copyright /usr/share/doc/libghc-*/copyright /usr/share/doc/libgmp*/copyright /usr/share/doc/libffi*/copyright; do \
      if [ -f "$notice" ]; then package=$(basename "$(dirname "$notice")"); mkdir -p "/out/notices/$package"; cp "$notice" "/out/notices/$package/copyright"; fi; \
    done \
    && dpkg-query -W -f='${binary:Package}\t${Version}\n' ghc 'libghc-*' 'libgmp*' 'libffi*' > /out/notices/installed-packages.tsv
FROM debian:bookworm-slim
RUN --mount=type=cache,id=ocv-web3-bookworm-apt-cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,id=ocv-web3-bookworm-apt-lists,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
    && printf 'Acquire::Retries "3";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nAPT::Keep-Downloaded-Packages "true";\n' > /etc/apt/apt.conf.d/80ocv-bounded-downloads \
    && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && sed -i 's|http://deb.debian.org/|https://deb.debian.org/|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends libgmp10 libnuma1 curl ca-certificates \
    && mkdir -p /usr/share/omnicivitas/site-certificates/notices \
    && for notice in /usr/share/doc/*/copyright; do \
      if [ -f "$notice" ]; then package=$(basename "$(dirname "$notice")"); mkdir -p "/usr/share/omnicivitas/site-certificates/notices/$package"; cp "$notice" "/usr/share/omnicivitas/site-certificates/notices/$package/copyright"; fi; \
    done \
    && useradd --system --uid 10001 --no-create-home certificate
COPY --from=builder /out/site-certificates /usr/local/bin/site-certificates
COPY --from=builder /out/certificate-fixtures /usr/local/bin/certificate-fixtures
COPY --from=builder /out/notices/ /usr/share/omnicivitas/site-certificates/notices/
USER 10001:10001
ENV PORT=7083
EXPOSE 7083
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 CMD curl --fail --silent --max-time 2 http://127.0.0.1:7083/ready || exit 1
ENTRYPOINT ["site-certificates"]
CMD ["+RTS", "-N1", "-M160m", "-A2m", "-RTS"]
