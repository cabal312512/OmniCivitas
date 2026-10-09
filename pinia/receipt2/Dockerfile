# syntax=docker/dockerfile:1
FROM rust:1.90.0-slim-bookworm AS native-build
RUN apt-get update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /work
COPY pinia/receipt2/ /work/pinia/receipt2/
COPY pcakage/desk4/ /work/pcakage/desk4/
ENV CARGO_TARGET_DIR=/work/target
RUN g++ -std=c++20 -O2 -Wall -Wextra pinia/receipt2/1.cpp pinia/receipt2/old.cc -o /work/ocv-circuit
RUN cargo test --manifest-path pcakage/desk4/Cargo.toml
RUN cargo build --release --manifest-path pcakage/desk4/Cargo.toml --bin ocv-communications

FROM native-build AS rust-wasm
RUN rustup target add wasm32-unknown-unknown
RUN cargo build --release --target wasm32-unknown-unknown --manifest-path pcakage/desk4/Cargo.toml --lib

FROM emscripten/emsdk:4.0.17 AS cpp-wasm
WORKDIR /work
COPY pinia/receipt2/ /work/pinia/receipt2/
RUN mkdir -p /artifacts && em++ -std=c++20 -O2 -fexceptions pinia/receipt2/1.cpp pinia/receipt2/old.cc --no-entry -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORTED_FUNCTIONS='["_ocv_run"]' -s EXPORTED_RUNTIME_METHODS='["ccall"]' -s ENVIRONMENT='web,worker,node' -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=268435456 -s INITIAL_MEMORY=33554432 -s STACK_SIZE=1048576 -o /artifacts/solver.mjs

FROM scratch AS wasm-artifacts
COPY --from=cpp-wasm /artifacts/solver.mjs /solver.mjs
COPY --from=cpp-wasm /artifacts/solver.wasm /solver.wasm
COPY --from=rust-wasm /work/target/wasm32-unknown-unknown/release/desk4.wasm /communications.wasm

FROM debian:bookworm-slim AS native-runtime
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=native-build /work/ocv-circuit /opt/ocv/ocv-circuit
COPY --from=native-build /work/target/release/ocv-communications /opt/ocv/ocv-communications
USER 65534:65534
HEALTHCHECK --interval=15s --timeout=2s --retries=3 CMD test -x /opt/ocv/ocv-circuit && test -x /opt/ocv/ocv-communications
CMD ["sleep", "infinity"]
