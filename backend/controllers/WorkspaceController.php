<?php

namespace Controllers;

use Models\WorkspaceModel;

class WorkspaceController
{
    private WorkspaceModel $model;

    public function __construct()
    {
        $this->model = new WorkspaceModel();
    }

    // GET /api/workspaces
    public function index(array $params): void
    {
        $userId = $_SESSION['user_id'];
        $workspaces = $this->model->findAllByUser($userId);
        $this->respond(200, ['workspaces' => $workspaces]);
    }

    // POST /api/workspaces
    public function store(array $params): void
    {
        $body = $this->getJsonBody();

        if (empty($body['name']) || strlen(trim($body['name'])) < 2) {
            $this->respond(422, ['errors' => ['name' => 'Le nom doit faire au moins 2 caractères.']]);
            return;
        }

        $userId = $_SESSION['user_id'];
        $id = $this->model->create(trim($body['name']), $userId);
        $workspace = $this->model->findById($id);

        $this->respond(201, ['workspace' => $workspace]);
    }

    // GET /api/workspaces/{id}
    public function show(array $params): void
    {
        $workspace = $this->resolveWorkspace((int) $params['id']);
        if ($workspace === null) return;

        $this->respond(200, ['workspace' => $workspace]);
    }

    // PUT /api/workspaces/{id}
    public function update(array $params): void
    {
        $workspace = $this->resolveWorkspace((int) $params['id']);
        if ($workspace === null) return;

        // Seul le propriétaire peut renommer un workspace
        if ($workspace['owner_id'] !== $_SESSION['user_id']) {
            $this->respond(403, ['error' => 'Seul le propriétaire peut modifier ce workspace.']);
            return;
        }

        $body = $this->getJsonBody();

        if (empty($body['name']) || strlen(trim($body['name'])) < 2) {
            $this->respond(422, ['errors' => ['name' => 'Le nom doit faire au moins 2 caractères.']]);
            return;
        }

        $this->model->update((int) $params['id'], trim($body['name']));
        $updated = $this->model->findById((int) $params['id']);

        $this->respond(200, ['workspace' => $updated]);
    }

    // DELETE /api/workspaces/{id}
    public function destroy(array $params): void
    {
        $workspace = $this->resolveWorkspace((int) $params['id']);
        if ($workspace === null) return;

        if ($workspace['owner_id'] !== $_SESSION['user_id']) {
            $this->respond(403, ['error' => 'Seul le propriétaire peut supprimer ce workspace.']);
            return;
        }

        $this->model->delete((int) $params['id']);

        // 204 : succès sans corps de réponse
        http_response_code(204);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    // Vérifie existence + accès — retourne le workspace ou répond et retourne null
    private function resolveWorkspace(int $id): ?array
    {
        $workspace = $this->model->findById($id);

        if ($workspace === null) {
            $this->respond(404, ['error' => 'Workspace introuvable.']);
            return null;
        }

        // Vérifie que l'user courant a accès (propriétaire ou membre)
        if (!$this->model->userHasAccess($id, $_SESSION['user_id'])) {
            $this->respond(403, ['error' => 'Accès non autorisé à ce workspace.']);
            return null;
        }

        return $workspace;
    }

    private function getJsonBody(): array
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    private function respond(int $status, array $data): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
    }
}