<?php

namespace Models;

use Config\Database;
use PDO;

class User
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // Recherche un user par email — utilisé lors du login
    // Retourne le tableau complet (avec password_hash) ou null
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, email, name, avatar_url, password_hash, created_at
             FROM users
             WHERE email = ?
             LIMIT 1'
        );
        $stmt->execute([$email]);

        $user = $stmt->fetch();

        // PDO retourne false si aucun résultat — on normalise en null
        return $user ?: null;
    }

    // Recherche un user par id — utilisé par le middleware pour hydrater la session
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, email, name, avatar_url, created_at
             FROM users
             WHERE id = ?
             LIMIT 1'
        );
        $stmt->execute([$id]);

        $user = $stmt->fetch();
        return $user ?: null;
    }

    // Crée un nouvel utilisateur et retourne son id
    public function create(string $email, string $name, string $passwordHash): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO users (email, name, password_hash)
             VALUES (?, ?, ?)'
        );
        $stmt->execute([$email, $name, $passwordHash]);

        return (int) $this->db->lastInsertId();
    }

    // Vérifie si un email est déjà utilisé — pour la validation à l'inscription
    public function emailExists(string $email): bool
    {
        $stmt = $this->db->prepare(
            'SELECT 1 FROM users WHERE email = ? LIMIT 1'
        );
        $stmt->execute([$email]);

        return $stmt->fetchColumn() !== false;
    }
}