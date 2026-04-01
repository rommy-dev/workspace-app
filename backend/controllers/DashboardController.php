<?php

namespace Controllers;

use Models\DashboardModel;

class DashboardController
{
    private DashboardModel $model;

    public function __construct()
    {
        $this->model = new DashboardModel();
    }

    // GET /api/dashboard
    public function index(array $params): void
    {
        $userId = $_SESSION['user_id'];
        $period = isset($_GET['period']) ? $_GET['period'] : '7d';

        $validPeriods = ['7d' => 7, '30d' => 30, '1y' => 365];
        $days = $validPeriods[$period] ?? 7;

        $stats           = $this->model->getStats($userId);
        $workspaces      = $this->model->getWorkspacesWithStats($userId);
        $recentActivity  = $this->model->getRecentActivity($userId);

        $fromDate = (new \DateTime())->modify("-{$days} days")->format('Y-m-d H:i:s');

        $workspaceIds = array_map(fn($ws) => $ws['id'], $workspaces);
        if (empty($workspaceIds)) {
            $workspaceIds = [0];
        }

        $timeline       = $this->model->getActivityByDate($workspaceIds, $fromDate);
        $userStats      = $this->model->getUserStatsForPeriod($userId, $fromDate);

        // Cast explicite — MySQL retourne les COUNT() en string par défaut
        $stats['workspaces_count']    = (int) $stats['workspaces_count'];
        $stats['pages_count']         = (int) $stats['pages_count'];
        $stats['comments_count']      = (int) $stats['comments_count'];
        $stats['collaborators_count'] = (int) $stats['collaborators_count'];

        foreach ($workspaces as &$ws) {
            $ws['pages_count']    = (int) $ws['pages_count'];
            $ws['comments_count'] = (int) $ws['comments_count'];
            $ws['members_count']  = (int) $ws['members_count'];
            $ws['is_owner']       = (bool) $ws['is_owner'];
        }

        $stats = array_merge($stats, $userStats, [
            'period' => $period,
            'timeline' => $timeline,
        ]);

        $this->respond(200, [
            'stats'           => $stats,
            'workspaces'      => $workspaces,
            'recent_activity' => $recentActivity,
        ]);
    }

    private function respond(int $status, array $data): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
    }
}