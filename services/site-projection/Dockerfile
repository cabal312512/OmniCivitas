FROM elixir:1.17.3-otp-27-alpine
ENV MIX_ENV=prod MIX_HOME=/ocv-cache/mix HEX_HOME=/ocv-cache/hex \
    MIX_DEPS_PATH=/ocv-cache/deps MIX_BUILD_PATH=/ocv-cache/build \
    HEX_HTTP_CONCURRENCY=1 HEX_HTTP_TIMEOUT=120 \
    ERL_FLAGS="+S 2:2 +SDcpu 1 +SDio 1 +A 2" \
    OCV_PROJECTION_LISTEN=0.0.0.0 PORT=4013 \
    ERL_CRASH_DUMP=/tmp/ocv-site-projection.dump
WORKDIR /work/services/site-projection
RUN mix local.hex --force && mix local.rebar --force
COPY services/site-projection/ ./
RUN --mount=type=cache,id=ocv-site-projection-hex,target=/ocv-cache/hex mix deps.get
COPY config/7/ /work/config/7/
COPY pcakage/locker13/ /work/pcakage/locker13/
COPY pinia/old13/ /work/pinia/old13/
RUN mix compile --warnings-as-errors \
    && addgroup -S ocv && adduser -S -G ocv ocv \
    && chown -R ocv:ocv /work /ocv-cache
USER ocv
EXPOSE 4013
CMD ["mix", "run", "--no-compile", "--no-deps-check", "--no-halt"]
