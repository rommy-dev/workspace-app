<?php

namespace Middleware;

class AuthMiddleware
{
    // Bloque la requête si l'utilisateur n'est pas authentifié.
    // Retourne l'user_id si tout est bon, arrête l'exécution sinon.
    public static function handle(): int
    {
        if (empty($_SESSION['user_id']) || !is_int($_SESSION['user_id'])) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Non authentifié. Veuillez vous connecter.']);
            exit; // Arrêt total — le controller ne s'exécutera pas
        }

        return (int) $_SESSION['user_id'];
    }
}