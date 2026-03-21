<?php

// Autoloader Composer — résout toutes les classes automatiquement
require_once __DIR__ . '/../vendor/autoload.php';

use Backend\Router;

// Toutes les réponses de l'API sont en JSON
header('Content-Type: application/json');

// Autorise les requêtes cross-origin en dev (nécessaire quand frontend != backend port)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Les requêtes OPTIONS sont des "preflight" CORS — on répond 200 et on s'arrête
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$router = new Router();

// ── Routes publiques (pas d'auth requise) ──────────────────────────
$router->get('/api/ping', [Controllers\TestController::class, 'ping']);
$router->post('/api/auth/register', [Controllers\AuthController::class, 'register']);
$router->post('/api/auth/login',    [Controllers\AuthController::class, 'login']);

// ── Routes protégées (auth requise — semaine 2) ────────────────────
// $router->get('/api/workspaces', [Controllers\WorkspaceController::class, 'index']);

// Lance le routing
$router->dispatch(
    $_SERVER['REQUEST_METHOD'],
    $_SERVER['REQUEST_URI']
);