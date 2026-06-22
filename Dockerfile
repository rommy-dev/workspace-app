FROM php:8.3-apache

# Extensions nécessaires pour PDO + MySQL
RUN docker-php-ext-install pdo pdo_mysql

# Active mod_rewrite pour le Front Controller (index.php)
RUN a2enmod rewrite

# Installer Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN composer install --no-dev --optimize-autoloader

# Pointe Apache vers public/ (ton front controller)
RUN sed -i 's|/var/www/html|/var/www/html/public|g' \
    /etc/apache2/sites-available/000-default.conf

# Autorise .htaccess dans public/
RUN printf '<Directory /var/www/html/public>\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>\n' >> /etc/apache2/apache2.conf

EXPOSE 80