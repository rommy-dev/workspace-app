<?php

namespace Models;

use Config\Database;
use PDO;

class DashboardModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    // Statistiques globales en une seule requête
    public function getStats(int $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT
                COUNT(DISTINCT w.id)                          AS workspaces_count,
                COUNT(DISTINCT p.id)                          AS pages_count,
                COUNT(DISTINCT c.id)                          AS comments_count,
                COUNT(DISTINCT wm.user_id)                    AS collaborators_count
            FROM workspaces w
            LEFT JOIN pages            p  ON p.workspace_id = w.id
            LEFT JOIN comments         c  ON c.page_id = p.id
            LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE w.owner_id = :uid
               OR EXISTS (
                   SELECT 1 FROM workspace_members
                   WHERE workspace_id = w.id AND user_id = :uid2
               )
        ");
        $stmt->execute([':uid' => $userId, ':uid2' => $userId]);

        return $stmt->fetch();
    }

    // Workspaces avec leurs stats, triés par activité décroissante
    public function getWorkspacesWithStats(int $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT
                w.id,
                w.name,
                w.created_at,
                (w.owner_id = :uid)            AS is_owner,
                COUNT(DISTINCT p.id)            AS pages_count,
                COUNT(DISTINCT c.id)            AS comments_count,
                COUNT(DISTINCT wm.user_id)      AS members_count,
                MAX(COALESCE(c.created_at, p.created_at, w.created_at)) AS last_activity
            FROM workspaces w
            LEFT JOIN pages             p  ON p.workspace_id = w.id
            LEFT JOIN comments          c  ON c.page_id = p.id
            LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
            WHERE w.owner_id = :uid2
               OR EXISTS (
                   SELECT 1 FROM workspace_members
                   WHERE workspace_id = w.id AND user_id = :uid3
               )
            GROUP BY w.id, w.name, w.created_at, w.owner_id
            ORDER BY last_activity DESC
        ");
        $stmt->execute([
            ':uid'  => $userId,
            ':uid2' => $userId,
            ':uid3' => $userId,
        ]);

        return $stmt->fetchAll();
    }

    // 10 dernières actions toutes entités confondues (pages + commentaires)
    public function getRecentActivity(int $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT
                'page'          AS type,
                p.id            AS entity_id,
                p.title         AS description,
                u.name          AS actor,
                w.id            AS workspace_id,
                w.name          AS workspace_name,
                p.created_at    AS happened_at
            FROM pages p
            JOIN users      u ON u.id = p.owner_id
            JOIN workspaces w ON w.id = p.workspace_id
            WHERE w.owner_id = :uid
               OR EXISTS (
                   SELECT 1 FROM workspace_members
                   WHERE workspace_id = w.id AND user_id = :uid2
               )

            UNION ALL

            SELECT
                'comment'                              AS type,
                c.id                                   AS entity_id,
                CONCAT(SUBSTRING(c.content, 1, 60),
                       IF(LENGTH(c.content) > 60,'…','')) AS description,
                u.name                                 AS actor,
                w.id                                   AS workspace_id,
                w.name                                 AS workspace_name,
                c.created_at                           AS happened_at
            FROM comments c
            JOIN users      u ON u.id = c.user_id
            JOIN pages      p ON p.id = c.page_id
            JOIN workspaces w ON w.id = p.workspace_id
            WHERE w.owner_id = :uid3
               OR EXISTS (
                   SELECT 1 FROM workspace_members
                   WHERE workspace_id = w.id AND user_id = :uid4
               )

            ORDER BY happened_at DESC
            LIMIT 10
        ");

        $stmt->execute([
            ':uid'  => $userId,
            ':uid2' => $userId,
            ':uid3' => $userId,
            ':uid4' => $userId,
        ]);

        return $stmt->fetchAll();
    }
}