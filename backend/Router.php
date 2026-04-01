<?php

namespace Backend;

class Router
{
    // Stocke toutes les routes : ['GET']['/api/workspaces'] = ['Controller', 'method', ['param1', ...]]
    private array $routes = [];

    // Méthodes d'enregistrement — une par verbe HTTP
    public function get(string $pattern, array $handler, array $middlewares = []): void
    {
        $this->addRoute('GET', $pattern, $handler, $middlewares);
    }

    public function post(string $pattern, array $handler, array $middlewares = []): void
    {
        $this->addRoute('POST', $pattern, $handler, $middlewares);
    }

    public function put(string $pattern, array $handler, array $middlewares = []): void
    {
        $this->addRoute('PUT', $pattern, $handler, $middlewares);
    }

    public function delete(string $pattern, array $handler, array $middlewares = []): void
    {
        $this->addRoute('DELETE', $pattern, $handler, $middlewares);
    }

    private function addRoute(string $method, string $pattern, array $handler, array $middlewares = []): void
    {
        $this->routes[$method][$pattern] = [
            'handler'     => $handler,
            'middlewares' => $middlewares,
        ];
    }

    // Point d'entrée principal — appelé depuis index.php
    public function dispatch(string $method, string $uri): void
    {
        // Retire la query string (?foo=bar) et décode l'URI
        $uri = parse_url(rawurldecode($uri), PHP_URL_PATH);

        // Normalise : retire le slash final sauf pour "/"
        if ($uri !== '/') {
            $uri = rtrim($uri, '/');
        }

        $methodRoutes = $this->routes[$method] ?? null;

        // L'URL existe-t-elle avec une autre méthode ? (pour 405 vs 404)
        if ($methodRoutes === null) {
            $this->handleMethodNotAllowed($uri);
            return;
        }

        foreach ($methodRoutes as $pattern => $route) {
            $params = $this->match($pattern, $uri);
            if ($params !== null) {
                $this->call($route, $params);
                return;
            }
        }

        // Vérifie si l'URI existe avec une autre méthode → 405 plutôt que 404
        foreach ($this->routes as $otherMethod => $otherRoutes) {
            if ($otherMethod === $method) continue;
            foreach ($otherRoutes as $pattern => $_) {
                if ($this->match($pattern, $uri) !== null) {
                    $this->respond(405, ['error' => 'Méthode non autorisée pour cette route']);
                    return;
                }
            }
        }

        $this->respond(404, ['error' => 'Route introuvable']);
    }

    // Convertit le pattern en regex et tente le match
    // Retourne un tableau de paramètres si match, null sinon
    private function match(string $pattern, string $uri): ?array
    {
        // Extrait les noms des paramètres : {id}, {workspaceId}, etc.
        preg_match_all('/\{([a-zA-Z_]+)\}/', $pattern, $paramNames);
        $paramNames = $paramNames[1]; // ['id', 'workspaceId', ...]

        // Transforme le pattern en regex
        // {id} → ([^/]+)   (capture tout sauf un slash)
        $regexPattern = preg_replace('/\{[a-zA-Z_]+\}/', '([^/]+)', $pattern);
        $regexPattern = '#^' . $regexPattern . '$#';

        if (!preg_match($regexPattern, $uri, $matches)) {
            return null;
        }

        array_shift($matches); // retire le match complet, garde seulement les groupes capturés

        // Associe noms et valeurs : ['id' => '42']
        return array_combine($paramNames, $matches) ?: [];
    }

    // Instancie le controller et appelle la méthode
    private function call(array $route, array $params): void
    {
        foreach ($route['middlewares'] as $middlewares) {
            $middlewares::handle();
        }

        [$controllerClass, $method] = $route['handler'];

        if (!class_exists($controllerClass)) {
            $this->respond(500, ['error' => "Controller '$controllerClass' introuvable"]);
            return;
        }

        $controller = new $controllerClass();

        if (!method_exists($controller, $method)) {
            $this->respond(500, ['error' => "Méthode '$method' introuvable sur $controllerClass"]);
            return;
        }

        // Les paramètres de route sont passés en argument
        $controller->$method($params);
    }

    private function handleMethodNotAllowed(string $uri): void
    {
        foreach ($this->routes as $routes) {
            foreach ($routes as $pattern => $_) {
                if ($this->match($pattern, $uri) !== null) {
                    $this->respond(405, ['error' => 'Méthode non autorisée pour cette route']);
                    return;
                }
            }
        }
        $this->respond(404, ['error' => 'Route introuvable']);
    }

    private function respond(int $status, array $data): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
    }
}