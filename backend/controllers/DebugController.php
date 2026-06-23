<?php

namespace Controllers;

class DebugController
{
    public function index(): void
    {
        $info = [
            'php_version' => PHP_VERSION,
            'env_vars' => [
                'DB_HOST' => getenv('DB_HOST') ?: 'NON DÉFINI',
                'DB_PORT' => getenv('DB_PORT') ?: 'NON DÉFINI',
                'DB_NAME' => getenv('DB_NAME') ?: 'NON DÉFINI',
                'DB_USER' => getenv('DB_USER') ?: 'NON DÉFINI',
                'DB_PASS' => getenv('DB_PASS') ? '*** DÉFINI ***' : 'NON DÉFINI',
            ],
            'pdo_drivers' => \PDO::getAvailableDrivers(),
        ];

        try {
            $host = getenv('DB_HOST');
            $port = getenv('DB_PORT') ?: '3306';
            $name = getenv('DB_NAME');
            $user = getenv('DB_USER');
            $pass = getenv('DB_PASS');

            $pdo = new \PDO(
                "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",
                $user, $pass,
                [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]
            );

            $info['db_connection'] = 'OK';
            $info['db_test_query'] = $pdo->query('SELECT 1')->fetchColumn();

        } catch (\Exception $e) {
            $info['db_connection'] = 'ERREUR';
            $info['db_error']      = $e->getMessage();
        }

        header('Content-Type: application/json');
        echo json_encode($info, JSON_PRETTY_PRINT);
    }
}