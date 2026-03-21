<?php

namespace Config;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $connection = null;

    // Empêche toute instanciation — ce n'est pas un objet, c'est un service statique
    private function __construct() {}

    // Cloner l'instance n'a pas de sens non plus pour un singleton
    private function __clone() {}

    public static function getConnection(): PDO
    {
        if (self::$connection === null) {
            self::$connection = self::createConnection();
        }

        return self::$connection;
    }

    private static function createConnection(): PDO
    {
        $envPath = __DIR__ . '/../../.env';

        if (!file_exists($envPath)) {
            throw new \RuntimeException('.env file not found at: ' . $envPath);
        }

        $env = parse_ini_file($envPath);

        $host   = $env['DB_HOST']    ?? 'localhost';
        $dbname = $env['DB_NAME']    ?? '';
        $user   = $env['DB_USER']    ?? 'root';
        $pass   = $env['DB_PASS']    ?? '';
        $port   = $env['DB_PORT']    ?? '3306';

        $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ];

        try {
            return new PDO($dsn, $user, $pass, $options);
        } catch (PDOException $e) {
            // On ne re-throw pas le message brut en prod
            throw new \RuntimeException(
                'Erreur de connexion à la base de données. Vérifiez votre .env.',
                (int) $e->getCode(),
                $e  // $e reste accessible via getPrevious() pour le debug
            );
        }
    }
}