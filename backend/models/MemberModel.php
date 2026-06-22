<?php

namespace Models;

use Config\Database;
use PDO;

class MemberModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // Tous les membres d'un workspace avec leurs infos
    public function findAllByWorkspace(int $workspaceId): array
    {
        $stmt = $this->db->prepare("
            SELECT wm.id, wm.role, wm.created_at,
                   u.id AS user_id, u.name, u.email, u.avatar_url
            FROM workspace_members wm
            JOIN users u ON u.id = wm.user_id
            WHERE wm.workspace_id = ?
            ORDER BY wm.created_at ASC
        ");
        $stmt->execute([$workspaceId]);

        return $stmt->fetchAll();
    }

    // Récupère le rôle d'un user dans un workspace — null s'il n'est pas membre
    public function getMembership(int $workspaceId, int $userId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, role FROM workspace_members
             WHERE workspace_id = ? AND user_id = ?'
        );
        $stmt->execute([$workspaceId, $userId]);

        return $stmt->fetch() ?: null;
    }

    public function add(int $workspaceId, int $userId, string $role = 'viewer'): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO workspace_members (workspace_id, user_id, role)
             VALUES (?, ?, ?)'
        );
        $stmt->execute([$workspaceId, $userId, $role]);

        return (int) $this->db->lastInsertId();
    }

    public function remove(int $workspaceId, int $userId): bool
    {
        $stmt = $this->db->prepare(
            'DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?'
        );
        $stmt->execute([$workspaceId, $userId]);

        return $stmt->rowCount() > 0;
    }
}
