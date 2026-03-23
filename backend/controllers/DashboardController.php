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

        $stats           = $this->model->getStats($userId);
        $workspaces      = $this->model->getWorkspacesWithStats($userId);
        $recentActivity  = $this->model->getRecentActivity($userId);

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