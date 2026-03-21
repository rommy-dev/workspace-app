<?php
namespace Config;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $connection = null;

    // Empêche l'instanciation directe
    private function __construct() {}

    // Méthode statique pour récupérer la connexion
    public static function getConnection(): PDO
    {
        if (self::$connection === null) {
            // Charger les variables d'environnement depuis .env
            if (file_exists(__DIR__ . '/../../.env')) {
                $env = parse_ini_file(__DIR__ . '/../../.env');
            } else {
                throw new \Exception('.env file not found!');
            }

            $host = $env['DB_HOST'] ?? 'localhost';
            $dbname = $env['DB_NAME'] ?? 'test';
            $user = $env['DB_USER'] ?? 'root';
            $pass = $env['DB_PASS'] ?? '';

            $dsn = "mysql:host=$host;dbname=$dbname;charset=utf8mb4";

            try {
                self::$connection = new PDO($dsn, $user, $pass);
                self::$connection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            } catch (PDOException $e) {
                throw new \Exception("Erreur de connexion PDO : " . $e->getMessage());
            }
        }

        return self::$connection;
    }
}