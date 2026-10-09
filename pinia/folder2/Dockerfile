# syntax=docker/dockerfile:1
FROM rust:1.90.0-slim-bookworm AS native-build
WORKDIR /work
COPY pcakage/slot7/ /work/pcakage/slot7/
COPY pinia/folder2/ /work/pinia/folder2/
ENV CARGO_TARGET_DIR=/work/target
RUN --mount=type=cache,id=ocv-mechanics-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=ocv-mechanics-cargo-target,target=/work/target \
    cargo test --release --locked --manifest-path pcakage/slot7/Cargo.toml \
    && cargo build --release --locked --manifest-path pcakage/slot7/Cargo.toml --bin ocv-mechanics \
    && mkdir -p /work/artifacts && cp /work/target/release/ocv-mechanics /work/artifacts/ocv-mechanics

FROM native-build AS rust-wasm
RUN rustup target add wasm32-unknown-unknown
RUN --mount=type=cache,id=ocv-mechanics-cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=ocv-mechanics-cargo-target,target=/work/target \
    RUSTFLAGS='-C link-arg=--max-memory=268435456 -C link-arg=-zstack-size=1048576' \
    cargo build --release --locked --target wasm32-unknown-unknown --manifest-path pcakage/slot7/Cargo.toml --lib \
    && cp /work/target/wasm32-unknown-unknown/release/slot7.wasm /work/artifacts/mechanics.wasm

FROM scratch AS wasm-artifacts
COPY --from=rust-wasm /work/artifacts/mechanics.wasm /engines/mechanics.wasm
COPY --from=rust-wasm /work/pcakage/slot7/Cargo.lock /Cargo.lock

FROM native-build AS license-build
RUN --mount=type=cache,id=ocv-mechanics-cargo-registry,target=/usr/local/cargo/registry \
    mkdir -p /notices && for crate in /usr/local/cargo/registry/src/*/*; do \
      dest=/notices/$(basename "$crate"); mkdir -p "$dest"; cp "$crate/Cargo.toml" "$dest/Cargo.toml"; \
      find "$crate" -maxdepth 3 -type f \( -iname '*license*' -o -iname '*copying*' -o -iname '*copyright*' -o -iname '*notice*' \) \
        -exec cp --parents '{}' "$dest" ';'; \
    done
FROM scratch AS license-artifacts
COPY --from=license-build /notices/ /licenses/
COPY --from=license-build /work/pcakage/slot7/Cargo.lock /Cargo.lock

FROM debian:bookworm-slim AS native-runtime
COPY --from=native-build /work/artifacts/ocv-mechanics /opt/ocv/ocv-mechanics
USER 65534:65534
HEALTHCHECK --interval=15s --timeout=2s --retries=3 CMD test -x /opt/ocv/ocv-mechanics
CMD ["sleep", "infinity"]
