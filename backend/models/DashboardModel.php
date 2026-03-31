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

    public function getWorkspaceIdsForUser(int $userId): array
    {
        $stmt = $this->db->prepare("SELECT id FROM workspaces w WHERE w.owner_id = :uid OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = w.id AND user_id = :uid2)");
        $stmt->execute([':uid' => $userId, ':uid2' => $userId]);
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    public function getActivityByDate(array $workspaceIds, string $fromDate): array
    {
        if (empty($workspaceIds)) {
            return [];
        }

        $ids = implode(',', array_map('intval', $workspaceIds));

        $stmt = $this->db->prepare("SELECT DATE(created_at) AS day, COUNT(*) AS total, 'page' AS type FROM pages WHERE workspace_id IN ($ids) AND created_at >= :fromDate GROUP BY DATE(created_at)");
        $stmt->execute([':fromDate' => $fromDate]);
        $pages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $this->db->prepare("SELECT DATE(c.created_at) AS day, COUNT(*) AS total, 'comment' AS type FROM comments c JOIN pages p ON p.id = c.page_id WHERE p.workspace_id IN ($ids) AND c.created_at >= :fromDate GROUP BY DATE(c.created_at)");
        $stmt->execute([':fromDate' => $fromDate]);
        $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $results = [];
        foreach ($pages as $p) {
            $results[$p['day']]['pages'] = (int)$p['total'];
        }
        foreach ($comments as $c) {
            $results[$c['day']]['comments'] = (int)$c['total'];
        }

        ksort($results);

        $output = [];
        foreach ($results as $day => $values) {
            $output[] = [
                'date' => $day,
                'pages' => $values['pages'] ?? 0,
                'comments' => $values['comments'] ?? 0,
                'activity' => ($values['pages'] ?? 0) + ($values['comments'] ?? 0),
            ];
        }

        return $output;
    }

    public function getUserStatsForPeriod(int $userId, string $fromDate): array
    {
        $stmt = $this->db->prepare("SELECT COUNT(*) AS pages_created FROM pages WHERE owner_id = :uid AND created_at >= :fromDate");
        $stmt->execute([':uid' => $userId, ':fromDate' => $fromDate]);
        $pages = (int)$stmt->fetchColumn();

        $stmt = $this->db->prepare("SELECT COUNT(*) AS comments_created FROM comments WHERE user_id = :uid AND created_at >= :fromDate");
        $stmt->execute([':uid' => $userId, ':fromDate' => $fromDate]);
        $comments = (int)$stmt->fetchColumn();

        // Temps moyen de réponse aux commentaires (simplifié) : différence entre création du commentaire et le premier commentaire de réponse sur la même page
        $stmt = $this->db->prepare(
            "SELECT AVG(TIMESTAMPDIFF(MINUTE, c.created_at, r.created_at)) as avg_time
             FROM comments c
             JOIN comments r ON r.page_id = c.page_id AND r.created_at > c.created_at
             WHERE c.user_id = :uid AND c.created_at >= :fromDate"
        );
        $stmt->execute([':uid' => $userId, ':fromDate' => $fromDate]);
        $avg = $stmt->fetchColumn();

        return [
            'user_pages_created' => $pages,
            'user_comments' => $comments,
            'average_response_time' => $avg !== null ? round((float)$avg, 1) : null,
        ];
    }
}