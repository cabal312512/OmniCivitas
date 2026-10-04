# Optional, bounded integration runners; never part of the default core.
FROM eclipse-temurin:21-jdk-alpine AS java
WORKDIR /tests
RUN wget -q -T 60 -O /tests/junit.jar https://repo.maven.apache.org/maven2/org/junit/platform/junit-platform-console-standalone/1.11.4/junit-platform-console-standalone-1.11.4.jar
COPY tests/frameworks/native/ServiceTest.java .
RUN javac -cp junit.jar ServiceTest.java
CMD ["java","-Xmx256m","-jar","junit.jar","execute","--class-path",".","--scan-class-path","--fail-if-no-tests"]

FROM python:3.12-slim AS python
RUN pip install --no-cache-dir pytest==8.4.2
COPY tests/frameworks/native/test_service.py /tests/test_service.py
CMD ["python","-m","pytest","-q","/tests/test_service.py"]

FROM php:8.3-cli AS php
RUN apt-get update && apt-get install -y --no-install-recommends libxml2-dev libonig-dev && docker-php-ext-install dom xml xmlwriter mbstring && rm -rf /var/lib/apt/lists/*
RUN php -r '$r=file_get_contents("https://phar.phpunit.de/phpunit-11.5.56.phar");if($r===false)exit(1);file_put_contents("/tests.phpunit.phar",$r);'
COPY tests/frameworks/native/ServiceTest.php /tests/ServiceTest.php
CMD ["php","/tests.phpunit.phar","/tests/ServiceTest.php"]

FROM golang:1.24-alpine AS go
ENV GOCACHE=/ocv-deps/go/cache GOMODCACHE=/ocv-deps/go/modules
WORKDIR /tests
COPY tests/frameworks/native/service_test.go .
CMD ["go","test","-v","service_test.go"]

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=true DOTNET_CLI_HOME=/ocv-deps/dotnet NUGET_PACKAGES=/ocv-deps/nuget
WORKDIR /tests
COPY tests/frameworks/native/dotnet/ .
RUN dotnet restore --disable-parallel && dotnet build --no-restore
CMD ["dotnet","test","--no-restore","--no-build","--logger","console;verbosity=normal"]

FROM ruby:3.3-alpine AS ruby
RUN gem install minitest -v 5.25.5 --no-document
COPY tests/frameworks/native/service_test.rb /tests/service_test.rb
CMD ["ruby","/tests/service_test.rb"]
