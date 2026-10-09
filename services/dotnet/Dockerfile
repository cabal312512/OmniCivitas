FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ENV NUGET_PACKAGES=/ocv-deps/nuget DOTNET_CLI_HOME=/ocv-deps/dotnet DOTNET_CLI_TELEMETRY_OPTOUT=1
WORKDIR /src/services/dotnet
COPY services/dotnet ./
COPY config/parts /src/config/parts
COPY config/2/1.cs /src/config/2/1.cs
COPY pcakage/report2/old.cs /src/pcakage/report2/old.cs
RUN dotnet publish -c Release -o /app -p:UseSharedCompilation=false --disable-build-servers
FROM mcr.microsoft.com/dotnet/aspnet:8.0
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app ./
ENTRYPOINT ["dotnet","Receipt.dll"]
