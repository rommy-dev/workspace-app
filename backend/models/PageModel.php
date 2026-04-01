<?php

namespace Models;

use Config\Database;
use PDO;

class PageModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findAllByWorkspace(int $workspaceId): array
    {
        $stmt = $this->db->prepare("
            SELECT p.id, p.title, p.owner_id, p.created_at, p.updated_at,
                   u.name AS owner_name
            FROM pages p
            JOIN users u ON u.id = p.owner_id
            WHERE p.workspace_id = ?
            ORDER BY p.updated_at DESC
        ");
        $stmt->execute([$workspaceId]);

        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT p.id, p.title, p.content, p.workspace_id,
                   p.owner_id, p.created_at, p.updated_at,
                   u.name AS owner_name
            FROM pages p
            JOIN users u ON u.id = p.owner_id
            WHERE p.id = ?
        ");
        $stmt->execute([$id]);

        return $stmt->fetch() ?: null;
    }

    public function create(int $workspaceId, int $ownerId, string $title, ?string $content): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title, content) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$workspaceId, $ownerId, $title, $content]);

        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, string $title, ?string $content): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE pages SET title = ?, content = ? WHERE id = ?'
        );
        $stmt->execute([$title, $content, $id]);

        return $stmt->rowCount() > 0;
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM pages WHERE id = ?');
        $stmt->execute([$id]);

        return $stmt->rowCount() > 0;
    }
}