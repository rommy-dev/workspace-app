<?php

namespace Controllers;

use Models\User;

class AuthController
{
    private User $userModel;

    public function __construct()
    {
        $this->userModel = new User();
    }

    // POST /api/auth/register
    public function register(array $params): void
    {
        $body = $this->getJsonBody();

        // ── 1. Validation structurelle ──────────────────────────────
        $errors = [];

        if (empty($body['email'])) {
            $errors['email'] = 'L\'email est requis.';
        } elseif (!filter_var($body['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Format d\'email invalide.';
        }

        if (empty($body['name']) || strlen(trim($body['name'])) < 2) {
            $errors['name'] = 'Le nom doit faire au moins 2 caractères.';
        }

        if (empty($body['password']) || strlen($body['password']) < 8) {
            $errors['password'] = 'Le mot de passe doit faire au moins 8 caractères.';
        }

        if (!empty($errors)) {
            $this->respond(422, ['errors' => $errors]);
            return;
        }

        // ── 2. Validation métier ────────────────────────────────────
        if ($this->userModel->emailExists($body['email'])) {
            $this->respond(409, ['errors' => ['email' => 'Cet email est déjà utilisé.']]);
            return;
        }

        // ── 3. Hashage et création ──────────────────────────────────
        $hash = password_hash($body['password'], PASSWORD_BCRYPT);
        $userId = $this->userModel->create(
            strtolower(trim($body['email'])),
            trim($body['name']),
            $hash
        );

        // ── 4. Connexion automatique après inscription ──────────────
        $this->startSession($userId);

        $this->respond(201, [
            'message' => 'Compte créé avec succès.',
            'user'    => [
                'id'    => $userId,
                'email' => strtolower(trim($body['email'])),
                'name'  => trim($body['name']),
            ],
        ]);
    }

    // POST /api/auth/login
    public function login(array $params): void
    {
        $body = $this->getJsonBody();

        // Validation minimale — on ne précise pas quel champ est faux (sécurité)
        if (empty($body['email']) || empty($body['password'])) {
            $this->respond(400, ['error' => 'Email et mot de passe requis.']);
            return;
        }

        $user = $this->userModel->findByEmail(strtolower(trim($body['email'])));

        // Message délibérément vague — ne pas indiquer si c'est l'email ou le mot de passe
        // qui est faux (évite l'énumération d'utilisateurs)
        if ($user === null || !password_verify($body['password'], $user['password_hash'])) {
            $this->respond(401, ['error' => 'Identifiants incorrects.']);
            return;
        }

        $this->startSession($user['id']);

        $this->respond(200, [
            'message' => 'Connexion réussie.',
            'user'    => [
                'id'    => $user['id'],
                'email' => $user['email'],
                'name'  => $user['name'],
            ],
        ]);
    }

    // POST /api/auth/logout
    public function logout(array $params): void
    {
        // Efface les données de session côté serveur
        session_unset();
        session_destroy();

        // Expire le cookie côté client
        setcookie(session_name(), '', time() - 3600, '/');

        $this->respond(200, ['message' => 'Déconnexion réussie.']);
    }

    // GET /api/auth/me — retourne l'utilisateur courant (route protégée)
    public function me(array $params): void
    {
        // Le middleware garantit que user_id existe ici
        $user = $this->userModel->findById($_SESSION['user_id']);

        if ($user === null) {
            $this->respond(404, ['error' => 'Utilisateur introuvable.']);
            return;
        }

        $this->respond(200, ['user' => $user]);
    }

    // ── Helpers privés ──────────────────────────────────────────────

    private function startSession(int $userId): void
    {
        // Régénère l'ID de session après connexion — protection contre
        // la fixation de session (session fixation attack)
        session_regenerate_id(true);

        $_SESSION['user_id'] = $userId;
    }

    // Lit et décode le corps JSON de la requête
    private function getJsonBody(): array
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        // json_decode retourne null si le JSON est invalide ou vide
        return is_array($data) ? $data : [];
    }

    private function respond(int $status, array $data): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
    }
}