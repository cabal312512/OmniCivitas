# Fresh Linux workspace test. No OCV_* environment or host cache is inherited.
FROM node:24.14.1-alpine
ENV NX_DAEMON=false NG_BUILD_MAX_WORKERS=1 ASTRO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=1536 npm_config_cache=/audit/cache npm_config_store_dir=/audit/store TMPDIR=/audit/tmp
RUN mkdir -p /audit/tmp && npm install --global pnpm@10.34.6 --prefix /audit/tools
ENV PATH=/audit/tools/bin:$PATH
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm test:jest
EXPOSE 8080
CMD ["pnpm","dev"]
