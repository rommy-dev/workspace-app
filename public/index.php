<?php

require_once __DIR__ . '/../vendor/autoload.php';

use Backend\Router;
use Middleware\AuthMiddleware;

session_start();

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$uriPath = parse_url(rawurldecode($_SERVER['REQUEST_URI']), PHP_URL_PATH) ?? '/';
if ($uriPath !== '/') {
    $uriPath = rtrim($uriPath, '/');
}

$isApi = ($uriPath === '/api' || strpos($uriPath, '/api/') === 0);

// ── Frontend (SPA) ────────────────────────────────────────────────
if (!$isApi) {
    $frontendRoot = realpath(__DIR__ . '/../frontend');
    if ($frontendRoot !== false) {
        $requestedPath = realpath($frontendRoot . $uriPath);
        if ($requestedPath !== false && strpos($requestedPath, $frontendRoot) === 0 && is_file($requestedPath)) {
            $mime = @mime_content_type($requestedPath);
            if ($mime === false) {
                $ext = strtolower(pathinfo($requestedPath, PATHINFO_EXTENSION));
                switch ($ext) {
                    case 'css':  $mime = 'text/css'; break;
                    case 'js':   $mime = 'application/javascript'; break;
                    case 'html': $mime = 'text/html'; break;
                    case 'json': $mime = 'application/json'; break;
                    case 'svg':  $mime = 'image/svg+xml'; break;
                    case 'png':  $mime = 'image/png'; break;
                    case 'jpg':
                    case 'jpeg': $mime = 'image/jpeg'; break;
                    case 'gif':  $mime = 'image/gif'; break;
                    case 'webp': $mime = 'image/webp'; break;
                    case 'ico':  $mime = 'image/x-icon'; break;
                    case 'woff': $mime = 'font/woff'; break;
                    case 'woff2':$mime = 'font/woff2'; break;
                    case 'ttf':  $mime = 'font/ttf'; break;
                    default:     $mime = 'application/octet-stream'; break;
                }
            }

            header('Content-Type: ' . $mime);
            readfile($requestedPath);
            exit;
        }
    }

    header('Content-Type: text/html; charset=UTF-8');
    require_once __DIR__ . '/../frontend/index.html';
    exit;
}

// ── API ────────────────────────────────────────────────────────────
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$router = new Router();

// ── Routes publiques ───────────────────────────────────────────────
$router->get('/api/ping',           [Controllers\TestController::class, 'ping']);
$router->get('/api/debug',          [Controllers\DebugController::class, 'index']);
$router->post('/api/auth/register', [Controllers\AuthController::class, 'register']);
$router->post('/api/auth/login',    [Controllers\AuthController::class, 'login']);

// ── Routes protégées — le middleware AuthMiddleware bloque si non connecté ──
$router->post('/api/auth/logout',   [Controllers\AuthController::class, 'logout'],  [AuthMiddleware::class]);
$router->get('/api/auth/me',        [Controllers\AuthController::class, 'me'],      [AuthMiddleware::class]);

// ── Profil utilisateur ─────────────────────────────────────────────
$router->get('/api/users/{id}',     [Controllers\ProfileController::class, 'show'],           [AuthMiddleware::class]);
$router->get('/api/profile',        [Controllers\ProfileController::class, 'me'],            [AuthMiddleware::class]);
$router->put('/api/profile',        [Controllers\ProfileController::class, 'update'],        [AuthMiddleware::class]);
$router->post('/api/profile/avatar', [Controllers\ProfileController::class, 'uploadAvatar'],  [AuthMiddleware::class]);
$router->put('/api/profile/password', [Controllers\ProfileController::class, 'updatePassword'], [AuthMiddleware::class]);

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

// ── Pages partagées avec moi ───────────────────────────────────────
$router->get('/api/pages/shared',
    [Controllers\PageShareController::class, 'sharedIndex'],
    [AuthMiddleware::class]);

// ── Partage de pages ───────────────────────────────────────────────
$router->get('/api/workspaces/{workspaceId}/pages/{pageId}/shares',
    [Controllers\PageShareController::class, 'index'],
    [AuthMiddleware::class]);

$router->post('/api/workspaces/{workspaceId}/pages/{pageId}/shares',
    [Controllers\PageShareController::class, 'store'],
    [AuthMiddleware::class]);

$router->put('/api/workspaces/{workspaceId}/pages/{pageId}/shares/{userId}',
    [Controllers\PageShareController::class, 'update'],
    [AuthMiddleware::class]);

$router->delete('/api/workspaces/{workspaceId}/pages/{pageId}/shares/{userId}',
    [Controllers\PageShareController::class, 'destroy'],
    [AuthMiddleware::class]);

    // ── Commentaires ──────────────────────────────────────────────────
$router->get('/api/workspaces/{workspaceId}/pages/{pageId}/comments',
    [Controllers\CommentController::class, 'index'],
    [AuthMiddleware::class]);

$router->post('/api/workspaces/{workspaceId}/pages/{pageId}/comments',
    [Controllers\CommentController::class, 'store'],
    [AuthMiddleware::class]);

$router->put('/api/workspaces/{workspaceId}/pages/{pageId}/comments/{id}',
    [Controllers\CommentController::class, 'update'],
    [AuthMiddleware::class]);

$router->delete('/api/workspaces/{workspaceId}/pages/{pageId}/comments/{id}',
    [Controllers\CommentController::class, 'destroy'],
    [AuthMiddleware::class]);

// ── Membres du workspace ──────────────────────────────────────────
$router->get('/api/workspaces/{id}/members',
    [Controllers\MemberController::class, 'index'],
    [AuthMiddleware::class]);

$router->post('/api/workspaces/{id}/members',
    [Controllers\MemberController::class, 'store'],
    [AuthMiddleware::class]);

$router->delete('/api/workspaces/{id}/members/{userId}',
    [Controllers\MemberController::class, 'destroy'],
    [AuthMiddleware::class]);

    // ── Dashboard ─────────────────────────────────────────────────────
$router->get('/api/dashboard',
    [Controllers\DashboardController::class, 'index'],
    [AuthMiddleware::class]);
    
$router->dispatch(
    $_SERVER['REQUEST_METHOD'],
    $uriPath
);
