FROM ruby:3.3-slim AS build
ENV BUNDLE_PATH=/ocv-deps/gems BUNDLE_USER_HOME=/ocv-deps/bundle
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libssl-dev pkg-config && rm -rf /var/lib/apt/lists/*
COPY services/sinatra/Gemfile services/sinatra/Gemfile.lock ./
RUN bundle install --jobs 1
FROM ruby:3.3-slim
ENV BUNDLE_PATH=/ocv-deps/gems BUNDLE_USER_HOME=/ocv-deps/bundle
WORKDIR /app
COPY --from=build /ocv-deps /ocv-deps
COPY --from=build /app/Gemfile* ./
COPY services/sinatra/main.rb ./
COPY pinia/templates2/old.rb ./pinia/templates2/old.rb
COPY config/2/4.rb ./config/2/4.rb
CMD ["bundle","exec","ruby","main.rb"]
