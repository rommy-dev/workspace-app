<?php

namespace Models;

use Config\Database;
use PDO;

class ProfileModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // Récupère le profil public d'un utilisateur (id, name, email, avatar_url, created_at)
    public function findPublicById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, name, email, avatar_url, created_at
             FROM users
             WHERE id = ?
             LIMIT 1'
        );
        $stmt->execute([$id]);

        $user = $stmt->fetch();
        return $user ?: null;
    }

    // Récupère le profil complet incluant password_hash (pour vérification)
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, email, name, avatar_url, password_hash, created_at
             FROM users
             WHERE id = ?
             LIMIT 1'
        );
        $stmt->execute([$id]);

        $user = $stmt->fetch();
        return $user ?: null;
    }

    // Vérifie si un email est utilisé par un autre utilisateur
    public function emailExistsForOtherUser(string $email, int $userId): bool
    {
        $stmt = $this->db->prepare(
            'SELECT 1 FROM users
             WHERE email = ? AND id != ?
             LIMIT 1'
        );
        $stmt->execute([$email, $userId]);

        return $stmt->fetchColumn() !== false;
    }

    // Met à jour le profil (name, email, avatar_url)
    public function updateProfile(int $id, string $name, string $email, ?string $avatarUrl): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE users
             SET name = ?, email = ?, avatar_url = ?
             WHERE id = ?'
        );

        return $stmt->execute([$name, $email, $avatarUrl, $id]);
    }

    // Met à jour le hash du mot de passe
    public function updatePassword(int $id, string $hash): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE users
             SET password_hash = ?
             WHERE id = ?'
        );

        return $stmt->execute([$hash, $id]);
    }
}
