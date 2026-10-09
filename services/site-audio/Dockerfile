# syntax=docker/dockerfile:1
FROM rust:1.90.0-slim-bookworm AS native-build
RUN apt-get update && apt-get install -y --no-install-recommends g++ nlohmann-json3-dev=3.11.2-2 && rm -rf /var/lib/apt/lists/*
WORKDIR /work
COPY services/site-audio/ /work/services/site-audio/
COPY pcakage/wood3/ /work/pcakage/wood3/
COPY pinia/stock13/ /work/pinia/stock13/
COPY config/8/ /work/config/8/
ENV CARGO_TARGET_DIR=/work/target CARGO_BUILD_JOBS=1
RUN mkdir -p /work/artifacts /work/notices && g++ -std=c++20 -O2 -Wall -Wextra -I/work \
    services/site-audio/cpp/old.cc services/site-audio/cpp/2.cpp \
    services/site-audio/cpp/common2.cpp services/site-audio/cpp/ledger.cpp \
    pcakage/wood3/OfflineComposition.cpp -o /work/artifacts/audio \
    && cp /usr/share/doc/nlohmann-json3-dev/copyright /work/notices/nlohmann-json-copyright
RUN --mount=type=cache,id=ocv-site-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=ocv-site-cargo-target,target=/work/target \
    touch services/site-audio/rust/old.rs services/site-audio/rust/2.rs pinia/stock13/artifact.rs \
    && cargo build --release --locked --manifest-path services/site-audio/rust/Cargo.toml --bin receipt \
    && cp /work/target/release/receipt /work/artifacts/receipt \
    && for crate in /usr/local/cargo/registry/src/*/*; do \
      if test -d "$crate"; then \
        dest=/work/notices/$(basename "$crate"); mkdir -p "$dest"; \
        cp "$crate/Cargo.toml" "$dest/Cargo.toml"; \
        find "$crate" -maxdepth 2 -type f \( -iname '*license*' -o -iname '*copying*' -o -iname '*notice*' \) -exec cp '{}' "$dest" ';'; \
      fi; \
    done
RUN mkdir -p /work/notices/rust-standard-library \
    && cp "$(rustc --print sysroot)/share/doc/rust/COPYRIGHT.html" /work/notices/rust-standard-library/ \
    && cp -R "$(rustc --print sysroot)/share/doc/rust/licenses" /work/notices/rust-standard-library/

# Opt-in test target; no test toolchain or test binary enters the runtime image.
FROM native-build AS native-tests
RUN g++ -std=c++20 -O2 -Wall -Wextra -I/work \
    services/site-audio/fixtures/core.cpp services/site-audio/cpp/2.cpp \
    services/site-audio/cpp/common2.cpp services/site-audio/cpp/ledger.cpp \
    pcakage/wood3/OfflineComposition.cpp -o /work/artifacts/core-check \
    && /work/artifacts/core-check
RUN --mount=type=cache,id=ocv-site-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=ocv-site-cargo-target,target=/work/target \
    touch services/site-audio/rust/old.rs services/site-audio/rust/2.rs pinia/stock13/artifact.rs \
    && cargo test --locked --manifest-path services/site-audio/rust/Cargo.toml

FROM scratch AS license-artifacts
COPY --from=native-build /work/notices/ /licenses/
COPY --from=native-build /work/services/site-audio/rust/Cargo.lock /Cargo.lock

FROM debian:bookworm-slim AS native-runtime
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=native-build /work/artifacts/audio /opt/site/audio
COPY --from=native-build /work/artifacts/receipt /opt/site/receipt
COPY --from=native-build /work/notices/ /opt/site/notices/
USER 65534:65534
HEALTHCHECK --interval=15s --timeout=2s --retries=3 CMD test -x /opt/site/audio && test -x /opt/site/receipt
CMD ["sleep", "infinity"]
