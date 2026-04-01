<?php

namespace Controllers;

use Models\PageModel;
use Models\PageShareModel;
use Models\WorkspaceModel;

class PageController
{
    private PageModel $pageModel;
    private PageShareModel $pageShareModel;
    private WorkspaceModel $workspaceModel;

    public function __construct()
    {
        $this->pageModel      = new PageModel();
        $this->pageShareModel = new PageShareModel();
        $this->workspaceModel = new WorkspaceModel();
    }

    // GET /api/workspaces/{workspaceId}/pages
    public function index(array $params): void
    {
        if (!$this->resolveWorkspaceAccess((int) $params['workspaceId'])) return;

        $pages = $this->pageModel->findAllByWorkspace((int) $params['workspaceId']);
        $this->respond(200, ['pages' => $pages]);
    }

    // POST /api/workspaces/{workspaceId}/pages
    public function store(array $params): void
    {
        $workspaceId = (int) $params['workspaceId'];
        if (!$this->resolveWorkspaceAccess($workspaceId)) return;
        if (!$this->requirePageWriteAccess($workspaceId)) return;

        $body = $this->getJsonBody();

        if (empty($body['title']) || strlen(trim($body['title'])) < 1) {
            $this->respond(422, ['errors' => ['title' => 'Le titre est requis.']]);
            return;
        }

        $id = $this->pageModel->create(
            (int) $params['workspaceId'],
            $_SESSION['user_id'],
            trim($body['title']),
            $body['content'] ?? null
        );

        $page = $this->pageModel->findById($id);
        $this->respond(201, ['page' => $page]);
    }

    // GET /api/workspaces/{workspaceId}/pages/{id}
    public function show(array $params): void
    {
        $page = $this->resolvePageForRead((int) $params['id'], (int) $params['workspaceId']);
        if ($page === null) return;

        $this->respond(200, ['page' => $page]);
    }

    // PUT /api/workspaces/{workspaceId}/pages/{id}
    public function update(array $params): void
    {
        $workspaceId = (int) $params['workspaceId'];
        $page = $this->resolvePageForEdit((int) $params['id'], $workspaceId);
        if ($page === null) return;

        $body = $this->getJsonBody();

        if (empty($body['title']) || strlen(trim($body['title'])) < 1) {
            $this->respond(422, ['errors' => ['title' => 'Le titre est requis.']]);
            return;
        }

        $this->pageModel->update(
            (int) $params['id'],
            trim($body['title']),
            $body['content'] ?? null
        );

        $updated = $this->pageModel->findById((int) $params['id']);
        $this->respond(200, ['page' => $updated]);
    }

    // DELETE /api/workspaces/{workspaceId}/pages/{id}
    public function destroy(array $params): void
    {
        $workspaceId = (int) $params['workspaceId'];
        if (!$this->resolveWorkspaceAccess($workspaceId)) return;
        if (!$this->requirePageWriteAccess($workspaceId)) return;

        $page = $this->resolvePage((int) $params['id'], (int) $params['workspaceId']);
        if ($page === null) return;

        $this->pageModel->delete((int) $params['id']);
        http_response_code(204);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private function resolveWorkspaceAccess(int $workspaceId): bool
    {
        $workspace = $this->workspaceModel->findById($workspaceId);

        if ($workspace === null) {
            $this->respond(404, ['error' => 'Workspace introuvable.']);
            return false;
        }

        if (!$this->workspaceModel->userHasAccess($workspaceId, $_SESSION['user_id'])) {
            $this->respond(403, ['error' => 'Accès non autorisé à ce workspace.']);
            return false;
        }

        return true;
    }

    private function requirePageWriteAccess(int $workspaceId): bool
    {
        $role = $this->workspaceModel->getUserRole($workspaceId, $_SESSION['user_id']);

        if ($role === null) {
            $this->respond(403, ['error' => 'Accès non autorisé à ce workspace.']);
            return false;
        }

        if (!in_array($role, ['owner', 'admin', 'editor'], true)) {
            $this->respond(403, ['error' => 'Permissions insuffisantes pour modifier les pages.']);
            return false;
        }

        return true;
    }

    private function resolvePageForRead(int $pageId, int $workspaceId): ?array
    {
        $workspace = $this->workspaceModel->findById($workspaceId);

        if ($workspace === null) {
            $this->respond(404, ['error' => 'Workspace introuvable.']);
            return null;
        }

        $page = $this->resolvePage($pageId, $workspaceId);
        if ($page === null) return null;

        $userId = $_SESSION['user_id'];

        if ($this->workspaceModel->userHasAccess($workspaceId, $userId)) {
            return $page;
        }

        $permission = $this->pageShareModel->getPermissionForUser($pageId, $userId);
        if ($permission !== null) {
            return $page;
        }

        $this->respond(403, ['error' => 'Accès non autorisé à cette page.']);
        return null;
    }

    private function resolvePageForEdit(int $pageId, int $workspaceId): ?array
    {
        $workspace = $this->workspaceModel->findById($workspaceId);

        if ($workspace === null) {
            $this->respond(404, ['error' => 'Workspace introuvable.']);
            return null;
        }

        $page = $this->resolvePage($pageId, $workspaceId);
        if ($page === null) return null;

        $userId = $_SESSION['user_id'];
        $role = $this->workspaceModel->getUserRole($workspaceId, $userId);

        if ($role !== null && in_array($role, ['owner', 'admin', 'editor'], true)) {
            return $page;
        }

        $permission = $this->pageShareModel->getPermissionForUser($pageId, $userId);
        if ($permission === 'edit') {
            return $page;
        }

        $this->respond(403, ['error' => 'Permissions insuffisantes pour modifier cette page.']);
        return null;
    }

    // Vérifie que la page existe ET appartient bien à ce workspace
    private function resolvePage(int $pageId, int $workspaceId): ?array
    {
        $page = $this->pageModel->findById($pageId);

        if ($page === null || (int) $page['workspace_id'] !== $workspaceId) {
            $this->respond(404, ['error' => 'Page introuvable.']);
            return null;
        }

        return $page;
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
