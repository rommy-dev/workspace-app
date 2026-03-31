<?php

namespace Models;

use Config\Database;
use PDO;

class PageShareModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    public function findAllByPage(int $pageId): array
    {
        $stmt = $this->db->prepare("
            SELECT ps.id, ps.permission, ps.created_at,
                   u.id AS user_id, u.name, u.email
            FROM page_shares ps
            JOIN users u ON u.id = ps.user_id
            WHERE ps.page_id = ?
            ORDER BY ps.created_at ASC
        ");
        $stmt->execute([$pageId]);

        return $stmt->fetchAll();
    }

    public function findByPageAndUser(int $pageId, int $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT ps.id, ps.permission, ps.created_at,
                   u.id AS user_id, u.name, u.email
            FROM page_shares ps
            JOIN users u ON u.id = ps.user_id
            WHERE ps.page_id = ? AND ps.user_id = ?
            LIMIT 1
        ");
        $stmt->execute([$pageId, $userId]);

        return $stmt->fetch() ?: null;
    }

    public function getPermissionForUser(int $pageId, int $userId): ?string
    {
        $stmt = $this->db->prepare(
            'SELECT permission FROM page_shares WHERE page_id = ? AND user_id = ? LIMIT 1'
        );
        $stmt->execute([$pageId, $userId]);
        $permission = $stmt->fetchColumn();

        return $permission !== false ? (string) $permission : null;
    }

    public function create(int $pageId, int $userId, string $permission): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO page_shares (page_id, user_id, permission) VALUES (?, ?, ?)'
        );
        $stmt->execute([$pageId, $userId, $permission]);

        return (int) $this->db->lastInsertId();
    }

    public function updatePermission(int $pageId, int $userId, string $permission): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE page_shares SET permission = ? WHERE page_id = ? AND user_id = ?'
        );
        $stmt->execute([$permission, $pageId, $userId]);

        return $stmt->rowCount() > 0;
    }

    public function delete(int $pageId, int $userId): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM page_shares WHERE page_id = ? AND user_id = ?'
        );
        $stmt->execute([$pageId, $userId]);

        return $stmt->rowCount() > 0;
    }

    public function findPagesSharedWithUser(int $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT ps.permission,
                   ps.created_at AS shared_at,
                   p.id AS page_id,
                   p.title,
                   p.workspace_id,
                   p.updated_at,
                   w.name AS workspace_name,
                   u.name AS owner_name
            FROM page_shares ps
            JOIN pages p ON p.id = ps.page_id
            JOIN workspaces w ON w.id = p.workspace_id
            LEFT JOIN users u ON u.id = p.owner_id
            WHERE ps.user_id = ?
            ORDER BY ps.created_at DESC
        ");
        $stmt->execute([$userId]);

        return $stmt->fetchAll();
    }
}
