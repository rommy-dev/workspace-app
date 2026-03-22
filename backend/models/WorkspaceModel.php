<?php

namespace Models;

use Config\Database;
use PDO;

class WorkspaceModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // Tous les workspaces accessibles par un user :
    // ceux qu'il possède + ceux où il est membre
    public function findAllByUser(int $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT DISTINCT w.id, w.name, w.owner_id, w.created_at,
                   (w.owner_id = :uid) AS is_owner
            FROM workspaces w
            LEFT JOIN workspace_members wm
                   ON wm.workspace_id = w.id AND wm.user_id = :uid2
            WHERE w.owner_id = :uid3 OR wm.user_id = :uid4
            ORDER BY w.created_at DESC
        ");
        $stmt->execute([
            ':uid'  => $userId,
            ':uid2' => $userId,
            ':uid3' => $userId,
            ':uid4' => $userId,
        ]);

        return $stmt->fetchAll();
    }

    // Cherche un workspace par id — sans vérification d'accès (faite dans le controller)
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT id, name, owner_id, created_at FROM workspaces WHERE id = ?'
        );
        $stmt->execute([$id]);

        return $stmt->fetch() ?: null;
    }

    public function create(string $name, int $ownerId): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO workspaces (name, owner_id) VALUES (?, ?)'
        );
        $stmt->execute([$name, $ownerId]);

        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, string $name): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE workspaces SET name = ? WHERE id = ?'
        );
        $stmt->execute([$name, $id]);

        // rowCount() retourne le nombre de lignes modifiées
        return $stmt->rowCount() > 0;
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM workspaces WHERE id = ?');
        $stmt->execute([$id]);

        return $stmt->rowCount() > 0;
    }

    // Vérifie si un user a accès à un workspace (propriétaire ou membre)
    // Utilisé par PageController pour valider l'accès avant toute action sur une page
    public function userHasAccess(int $workspaceId, int $userId): bool
    {
        $stmt = $this->db->prepare("
            SELECT 1 FROM workspaces WHERE id = ? AND owner_id = ?
            UNION
            SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?
            LIMIT 1
        ");
        $stmt->execute([$workspaceId, $userId, $workspaceId, $userId]);

        return $stmt->fetchColumn() !== false;
    }
}