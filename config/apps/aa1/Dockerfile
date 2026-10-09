ARG DOTNET_SDK_IMAGE=mcr.microsoft.com/dotnet/sdk:8.0.425
FROM ${DOTNET_SDK_IMAGE} AS build
WORKDIR /workspace
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_CLI_HOME=/cache/dotnet NUGET_PACKAGES=/cache/nuget DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE=true DOTNET_GCHeapHardLimit=0x50000000
COPY config/apps/aa1 ./config/apps/aa1
COPY config/parts ./config/parts
RUN --mount=type=cache,id=ocv-nuget-8-workshop,target=/cache/nuget dotnet publish config/apps/aa1/Bench.csproj -c Release -o /out -p:UseSharedCompilation=false --disable-build-servers
FROM scratch AS browser-artifacts
COPY --from=build /out/wwwroot /ui
