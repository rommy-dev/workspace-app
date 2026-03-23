<?php

namespace Models;

use Config\Database;
use PDO;

class CommentModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // Tous les commentaires d'une page, avec le nom de l'auteur
    public function findAllByPage(int $pageId): array
    {
        $stmt = $this->db->prepare("
            SELECT c.id, c.content, c.user_id, c.page_id,
                   c.created_at, c.updated_at,
                   u.name AS author_name
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.page_id = ?
            ORDER BY c.created_at ASC
        ");
        $stmt->execute([$pageId]);

        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT c.id, c.content, c.user_id, c.page_id,
                   c.created_at, c.updated_at,
                   u.name AS author_name
            FROM comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = ?
        ");
        $stmt->execute([$id]);

        return $stmt->fetch() ?: null;
    }

    public function create(int $pageId, int $userId, string $content): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO comments (page_id, user_id, content) VALUES (?, ?, ?)'
        );
        $stmt->execute([$pageId, $userId, $content]);

        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, string $content): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE comments SET content = ? WHERE id = ?'
        );
        $stmt->execute([$content, $id]);

        return $stmt->rowCount() > 0;
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM comments WHERE id = ?');
        $stmt->execute([$id]);

        return $stmt->rowCount() > 0;
    }
}
