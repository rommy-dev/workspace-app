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
        $envDir = realpath(__DIR__ . '/..') ?: __DIR__ . '/..';
        $appEnv = getenv('APP_ENV') ?: ($_SERVER['APP_ENV'] ?? null);

        $envPath = $envDir . '/.env';
        if ($appEnv === 'test' && file_exists($envDir . '/.env.test')) {
            $envPath = $envDir . '/.env.test';
        }

        $env = file_exists($envPath) ? parse_ini_file($envPath) : [];

        $envVar = static function (string $key): ?string {
            $value = getenv($key);
            return ($value === false) ? null : $value;
        };

        $hasEnvVars =
            $envVar('DB_HOST') !== null ||
            $envVar('DB_NAME') !== null ||
            $envVar('DB_USER') !== null ||
            $envVar('DB_PASS') !== null ||
            $envVar('DB_PORT') !== null;

        if (!$hasEnvVars && empty($env)) {
            throw new \RuntimeException('.env file not found at: ' . $envPath);
        }

        $host   = $envVar('DB_HOST') ?? ($env['DB_HOST'] ?? 'localhost');
        $dbname = $envVar('DB_NAME') ?? ($env['DB_NAME'] ?? '');
        $user   = $envVar('DB_USER') ?? ($env['DB_USER'] ?? 'root');
        $pass   = $envVar('DB_PASS') ?? ($env['DB_PASS'] ?? '');
        $port   = $envVar('DB_PORT') ?? ($env['DB_PORT'] ?? '3306');

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
