FROM composer:2 AS composer
FROM php:8.3-cli
ENV COMPOSER_HOME=/ocv-deps/composer COMPOSER_CACHE_DIR=/ocv-deps/composer-cache
RUN apt-get update && apt-get install -y --no-install-recommends git unzip libzip-dev libonig-dev && docker-php-ext-install pdo_mysql zip mbstring && rm -rf /var/lib/apt/lists/*
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
WORKDIR /app
RUN composer create-project --prefer-dist --no-interaction --no-dev laravel/laravel:12.0.0 /app && composer clear-cache
COPY services/laravel/composer.json services/laravel/composer.lock /app/
RUN composer install --prefer-dist --no-interaction --no-scripts --no-dev && composer clear-cache
COPY services/laravel/bootstrap.php /app/bootstrap/app.php
COPY services/laravel/routes.php /app/routes/api.php
COPY services/laravel/SchoolStudent.php /app/app/Models/SchoolStudent.php
COPY config/2/7.php /app/office/config/2/7.php
COPY pcakage/forms2/old.php /app/pcakage/forms2/old.php
CMD ["php","artisan","serve","--no-reload","--host=0.0.0.0","--port=8001"]
