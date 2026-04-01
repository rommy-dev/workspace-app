<?php

namespace Tests\Integration;

use Config\Database;
use PDO;
use PHPUnit\Framework\TestCase;

abstract class ApiTestCase extends TestCase
{
    private static $serverProcess = null;
    private static string $serverBaseUrl = '';
    private static bool $serverShutdownRegistered = false;

    protected string $baseUrl;
    protected PDO    $db;

    // Cookies de session pour simuler un utilisateur connecté
    protected ?string $sessionCookie = null;

    public static function setUpBeforeClass(): void
    {
        if (self::$serverBaseUrl !== '') {
            return;
        }

        $useExternal = getenv('USE_EXTERNAL_SERVER') === '1';
        $appUrl = getenv('APP_URL') ?: '';

        if ($useExternal && $appUrl !== '') {
            self::$serverBaseUrl = rtrim($appUrl, '/');
            return;
        }

        self::startLocalServer();
    }

    protected function setUp(): void
    {
        $this->baseUrl = self::$serverBaseUrl !== ''
            ? self::$serverBaseUrl
            : (getenv('APP_URL') ?: 'http://workspace-app.local');

        // Force la connexion vers la DB de test
        $this->db = new PDO(
            sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                getenv('DB_HOST') ?: 'localhost',
                getenv('DB_PORT') ?: '3306',
                getenv('DB_NAME') ?: 'workspace_app_test'
            ),
            getenv('DB_USER') ?: 'root',
            getenv('DB_PASS') ?: '',
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );

        $this->cleanDatabase();
    }

    protected function tearDown(): void
    {
        $this->cleanDatabase();
        $this->sessionCookie = null;
    }

    public static function tearDownAfterClass(): void
    {
        // Laisse le serveur vivre jusqu'à la fin du processus PHPUnit
    }

    private static function startLocalServer(): void
    {
        if (self::$serverProcess !== null) {
            return;
        }

        $docRoot = realpath(__DIR__ . '/../../public');
        if ($docRoot === false) {
            throw new \RuntimeException('Répertoire public introuvable.');
        }

        $router = $docRoot . '/index.php';
        $host = '127.0.0.1';
        $port = self::findAvailablePort($host);

        $cmd = sprintf(
            '%s -S %s:%d -t %s %s',
            escapeshellcmd(PHP_BINARY),
            $host,
            $port,
            escapeshellarg($docRoot),
            escapeshellarg($router)
        );

        $logDir = sys_get_temp_dir();
        $stdout = $logDir . '/phpunit-server.out.log';
        $stderr = $logDir . '/phpunit-server.err.log';

        $descriptorSpec = [
            0 => ['pipe', 'r'],
            1 => ['file', $stdout, 'a'],
            2 => ['file', $stderr, 'a'],
        ];

        $root = realpath(__DIR__ . '/../../') ?: null;
        $process = proc_open($cmd, $descriptorSpec, $pipes, $root);

        if (!is_resource($process)) {
            throw new \RuntimeException('Impossible de démarrer le serveur PHP intégré.');
        }

        self::$serverProcess = $process;
        self::$serverBaseUrl = "http://$host:$port";

        self::waitForServer($host, $port);

        if (!self::$serverShutdownRegistered) {
            self::$serverShutdownRegistered = true;
            register_shutdown_function([self::class, 'stopLocalServer']);
        }
    }

    private static function stopLocalServer(): void
    {
        if (!is_resource(self::$serverProcess)) {
            return;
        }

        proc_terminate(self::$serverProcess);
        proc_close(self::$serverProcess);
        self::$serverProcess = null;
    }

    private static function findAvailablePort(string $host): int
    {
        $socket = @stream_socket_server("tcp://$host:0", $errno, $errstr);
        if ($socket === false) {
            throw new \RuntimeException('Impossible de trouver un port libre.');
        }

        $name = stream_socket_get_name($socket, false);
        fclose($socket);

        $parts = explode(':', $name);
        return (int) end($parts);
    }

    private static function waitForServer(string $host, int $port): void
    {
        $deadline = microtime(true) + 5.0;

        do {
            $fp = @fsockopen($host, $port, $errno, $errstr, 0.2);
            if (is_resource($fp)) {
                fclose($fp);
                return;
            }
            usleep(100000);
        } while (microtime(true) < $deadline);

        throw new \RuntimeException('Le serveur PHP intégré ne répond pas.');
    }

    // Vide toutes les tables dans le bon ordre (respecte les FK)
    private function cleanDatabase(): void
    {
        $this->db->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach (['comments', 'page_shares', 'pages', 'workspace_members', 'workspaces', 'users'] as $table) {
            $this->db->exec("TRUNCATE TABLE $table");
        }
        $this->db->exec('SET FOREIGN_KEY_CHECKS = 1');
    }

    // ── Helpers HTTP ───────────────────────────────────────────────

    protected function request(string $method, string $path, array $body = [], bool $withSession = false): array
    {
        $url = $this->baseUrl . $path;

        $headers = ['Content-Type: application/json'];

        // Injecte le cookie de session si on simule un user connecté
        if ($withSession && $this->sessionCookie) {
            $headers[] = 'Cookie: ' . $this->sessionCookie;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_HEADER         => true, // pour récupérer les cookies de réponse
        ]);

        if (!empty($body)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }

        $response    = curl_exec($ch);
        $headerSize  = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $statusCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $rawHeaders = substr($response, 0, $headerSize);
        $rawBody    = substr($response, $headerSize);

        // Extrait le Set-Cookie pour les requêtes suivantes
        if (preg_match('/Set-Cookie:\s*([^\r\n]+)/i', $rawHeaders, $matches)) {
            $this->sessionCookie = explode(';', $matches[1])[0];
        }

        return [
            'status' => $statusCode,
            'body'   => json_decode($rawBody, true) ?? [],
        ];
    }

    // Connecte un user et stocke son cookie de session
    protected function loginAs(string $email, string $password): array
    {
        $res = $this->request('POST', '/api/auth/login', [
            'email'    => $email,
            'password' => $password,
        ]);

        $this->assertEquals(200, $res['status'], 'Le login doit réussir');

        return $res['body']['user'];
    }

    // Crée un user directement en DB — plus rapide que passer par l'API
    protected function createUser(string $name, string $email, string $password = 'motdepasse123'): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
        );
        $stmt->execute([$name, $email, password_hash($password, PASSWORD_BCRYPT)]);

        return (int) $this->db->lastInsertId();
    }

    // Crée un workspace directement en DB
    protected function createWorkspace(string $name, int $ownerId): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO workspaces (name, owner_id) VALUES (?, ?)'
        );
        $stmt->execute([$name, $ownerId]);

        return (int) $this->db->lastInsertId();
    }
}
