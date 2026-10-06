FROM node:24.14.1-alpine AS build
WORKDIR /workspace
ENV OCV_DEPS_ROOT=/ocv-deps OCV_STORE_DIR=/ocv-deps/pnpm/store OCV_VIRTUAL_STORE_DIR=/ocv-deps/pnpm/vstore npm_config_cache=/ocv-deps/cache/npm TEMP=/ocv-deps/tmp TMP=/ocv-deps/tmp ASTRO_TELEMETRY_DISABLED=1 NX_DAEMON=false NODE_OPTIONS=--max-old-space-size=2048
RUN mkdir -p /ocv-deps/tmp && npm install --global pnpm@10.34.6 --prefix /ocv-deps/tools
ENV PATH=/ocv-deps/tools/bin:$PATH
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc nx.json LICENSE ./
COPY scripts/guard-paths.mjs ./scripts/guard-paths.mjs
COPY config/apps/portal/package.json ./config/apps/portal/package.json
COPY config/apps/web2/package.json ./config/apps/web2/package.json
COPY config/apps/ng/package.json ./config/apps/ng/package.json
COPY services/gateway/package.json ./services/gateway/package.json
COPY services/archive/package.json ./services/archive/package.json
COPY pcakage/comon/package.json ./pcakage/comon/package.json
RUN --mount=type=cache,id=ocv-pnpm-10,target=/ocv-deps/pnpm/store pnpm install --frozen-lockfile
COPY config/apps/portal ./config/apps/portal
COPY pinia ./pinia
COPY config/apps/web2 ./config/apps/web2
COPY config/apps/ng ./config/apps/ng
COPY scripts/copy-angular.mjs ./scripts/copy-angular.mjs
COPY scripts/phase8-build.mjs ./scripts/phase8-build.mjs
COPY scripts/bundle-license-notices.mjs ./scripts/bundle-license-notices.mjs
COPY docs/licenses/alpinejs-3.17.4-LICENSE.md ./docs/licenses/alpinejs-3.17.4-LICENSE.md
COPY docs/licenses/piccolore-upstream-picocolors-ISC.txt ./docs/licenses/piccolore-upstream-picocolors-ISC.txt
COPY docs/licenses/edge-runtime-MIT.md ./docs/licenses/edge-runtime-MIT.md
COPY docs/licenses/q8-sources.json docs/licenses/tiny-case-1.0.3.txt docs/licenses/is-mobile-5.0.0.txt docs/licenses/formik-2.4.9.txt docs/licenses/agent-base-6.0.2.txt docs/licenses/https-proxy-agent-5.0.1.txt ./docs/licenses/
COPY pcakage/build2 ./pcakage/build2
COPY services/gateway ./services/gateway
COPY services/archive ./services/archive
COPY pcakage/comon ./pcakage/comon
COPY historical/station ./historical/station
FROM build AS gateway-build
RUN pnpm --filter @omnicivitas/gateway build

FROM build AS portal-build
COPY MEDIA_NOTICE.md /workspace/MEDIA_NOTICE.md
COPY research/finite-memory-rsa /workspace/research/finite-memory-rsa
COPY scripts/prepare-research.mjs /workspace/scripts/prepare-research.mjs
COPY scripts/research-publication.mjs /workspace/scripts/research-publication.mjs
COPY config/research-publication.json /workspace/config/research-publication.json
ENV NG_BUILD_MAX_WORKERS=1
RUN pnpm --filter @omnicivitas/ng build && pnpm --filter @omnicivitas/portal build

FROM build AS next-build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @omnicivitas/web2 build

FROM node:24.14.1-alpine AS gateway
WORKDIR /workspace
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NODE_OPTIONS=--max-old-space-size=256 OCV_LOG_DIR=/ocv-data
COPY --from=gateway-build /ocv-deps /ocv-deps
COPY --from=gateway-build /workspace/node_modules ./node_modules
COPY --from=gateway-build /workspace/services/gateway ./services/gateway
COPY --from=gateway-build /workspace/historical/station ./historical/station
RUN mkdir -p /ocv-data && chown node:node /ocv-data
USER node
CMD ["sh", "-c", "cd services/gateway && /ocv-deps/tools/bin/pnpm exec prisma migrate deploy && node dist/main.js"]

FROM node:24.14.1-alpine AS archive
WORKDIR /workspace
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=128
COPY --from=build /ocv-deps /ocv-deps
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/services/archive ./services/archive
COPY --from=build /workspace/pcakage/comon ./pcakage/comon
CMD ["node", "services/archive/src/api/main.mjs"]

FROM nginx:1.30.5-alpine AS portal
COPY infra/nginx/portal.conf /etc/nginx/conf.d/default.conf
COPY --from=portal-build /workspace/config/apps/portal/dist /usr/share/nginx/html

FROM node:24.14.1-alpine AS next
WORKDIR /workspace/config/apps/web2
ENV NODE_ENV=production HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=256
COPY --from=next-build /ocv-deps /ocv-deps
COPY --from=next-build /workspace/node_modules /workspace/node_modules
COPY --from=next-build /workspace/config/apps/web2 ./
COPY --from=next-build /workspace/scripts/bundle-license-notices.mjs /workspace/scripts/bundle-license-notices.mjs
USER node
CMD ["/ocv-deps/tools/bin/pnpm", "start"]
