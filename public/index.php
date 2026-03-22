<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Backend\Router;
use Middleware\AuthMiddleware;

session_start();

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$router = new Router();

// ── Routes publiques ───────────────────────────────────────────────
$router->get('/api/ping',           [Controllers\TestController::class, 'ping']);
$router->post('/api/auth/register', [Controllers\AuthController::class, 'register']);
$router->post('/api/auth/login',    [Controllers\AuthController::class, 'login']);

// ── Routes protégées — le middleware AuthMiddleware bloque si non connecté ──
$router->post('/api/auth/logout',   [Controllers\AuthController::class, 'logout'],  [AuthMiddleware::class]);
$router->get('/api/auth/me',        [Controllers\AuthController::class, 'me'],      [AuthMiddleware::class]);

// ── Workspaces ─────────────────────────────────────────────────────
$router->get('/api/workspaces',
    [Controllers\WorkspaceController::class, 'index'],
    [AuthMiddleware::class]);

$router->post('/api/workspaces',
    [Controllers\WorkspaceController::class, 'store'],
    [AuthMiddleware::class]);

$router->get('/api/workspaces/{id}',
    [Controllers\WorkspaceController::class, 'show'],
    [AuthMiddleware::class]);

$router->put('/api/workspaces/{id}',
    [Controllers\WorkspaceController::class, 'update'],
    [AuthMiddleware::class]);

$router->delete('/api/workspaces/{id}',
    [Controllers\WorkspaceController::class, 'destroy'],
    [AuthMiddleware::class]);

// ── Pages (imbriquées dans workspace) ──────────────────────────────
$router->get('/api/workspaces/{workspaceId}/pages',
    [Controllers\PageController::class, 'index'],
    [AuthMiddleware::class]);

$router->post('/api/workspaces/{workspaceId}/pages',
    [Controllers\PageController::class, 'store'],
    [AuthMiddleware::class]);

$router->get('/api/workspaces/{workspaceId}/pages/{id}',
    [Controllers\PageController::class, 'show'],
    [AuthMiddleware::class]);

$router->put('/api/workspaces/{workspaceId}/pages/{id}',
    [Controllers\PageController::class, 'update'],
    [AuthMiddleware::class]);

$router->delete('/api/workspaces/{workspaceId}/pages/{id}',
    [Controllers\PageController::class, 'destroy'],
    [AuthMiddleware::class]);
    
$router->dispatch(
    $_SERVER['REQUEST_METHOD'],
    $_SERVER['REQUEST_URI']
);