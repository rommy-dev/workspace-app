<?php

namespace Controllers;

use Models\PageShareModel;
use Models\PageModel;
use Models\User;
use Models\WorkspaceModel;

class PageShareController
{
    private PageShareModel $pageShareModel;
    private PageModel      $pageModel;
    private User           $userModel;
    private WorkspaceModel $workspaceModel;

    public function __construct()
    {
        $this->pageShareModel = new PageShareModel();
        $this->pageModel      = new PageModel();
        $this->userModel      = new User();
        $this->workspaceModel = new WorkspaceModel();
    }

    // GET /api/workspaces/{workspaceId}/pages/{pageId}/shares
    public function index(array $params): void
    {
        $workspaceId = (int) $params['workspaceId'];
        $pageId      = (int) $params['pageId'];

        $workspace = $this->resolveWorkspaceAccess($workspaceId);
        if ($workspace === null) return;

        $page = $this->resolvePage($pageId, $workspaceId);
        if ($page === null) return;

        $shares = $this->pageShareModel->findAllByPage($pageId);
        $this->respond(200, ['shares' => $shares]);
    }

    // POST /api/workspaces/{workspaceId}/pages/{pageId}/shares
    // Body : { "email": "bob@test.com", "permission": "read" }
    public function store(array $params): void
    {
        $workspaceId = (int) $params['workspaceId'];
        $pageId      = (int) $params['pageId'];

        $workspace = $this->resolveWorkspaceAccess($workspaceId);
        if ($workspace === null) return;

        $page = $this->resolvePage($pageId, $workspaceId);
        if ($page === null) return;

        $body = $this->getJsonBody();

        if (empty($body['email'])) {
            $this->respond(422, ['errors' => ['email' => 'L\'email est requis.']]);
            return;
        }

        $permission = $body['permission'] ?? 'read';
        $validPermissions = ['read', 'edit'];
        if (!in_array($permission, $validPermissions, true)) {
            $this->respond(422, ['errors' => ['permission' => 'Permission invalide. Valeurs : read, edit.']]);
            return;
        }

        $email  = strtolower(trim($body['email']));
        $target = $this->userModel->findByEmail($email);
        if ($target === null) {
            $this->respond(404, ['error' => 'Aucun utilisateur trouvé avec cet email.']);
            return;
        }

        $currentUserId = $_SESSION['user_id'];
        $targetId = (int) $target['id'];

        if ($targetId === $currentUserId) {
            $this->respond(409, ['error' => 'Impossible de partager une page avec vous-même.']);
            return;
        }

        if ((int) $workspace['owner_id'] === $targetId) {
            $this->respond(409, ['error' => 'Cet utilisateur est le propriétaire du workspace.']);
            return;
        }

        if ($this->workspaceModel->userHasAccess($workspaceId, $targetId)) {
            $this->respond(409, ['error' => 'Cet utilisateur est déjà membre du workspace.']);
            return;
        }

        if ($this->pageShareModel->getPermissionForUser($pageId, $targetId) !== null) {
            $this->respond(409, ['error' => 'Cet utilisateur a déjà accès à cette page.']);
            return;
        }

        $this->pageShareModel->create($pageId, $targetId, $permission);
        $share = $this->pageShareModel->findByPageAndUser($pageId, $targetId);

        $this->respond(201, ['share' => $share]);
    }

    // PUT /api/workspaces/{workspaceId}/pages/{pageId}/shares/{userId}
    public function update(array $params): void
    {
        $workspaceId = (int) $params['workspaceId'];
        $pageId      = (int) $params['pageId'];
        $targetId    = (int) $params['userId'];

        $workspace = $this->resolveWorkspaceAccess($workspaceId);
        if ($workspace === null) return;

        $page = $this->resolvePage($pageId, $workspaceId);
        if ($page === null) return;

        $body = $this->getJsonBody();
        $permission = $body['permission'] ?? null;
        $validPermissions = ['read', 'edit'];
        if (!is_string($permission) || !in_array($permission, $validPermissions, true)) {
            $this->respond(422, ['errors' => ['permission' => 'Permission invalide. Valeurs : read, edit.']]);
            return;
        }

        $existing = $this->pageShareModel->findByPageAndUser($pageId, $targetId);
        if ($existing === null) {
            $this->respond(404, ['error' => 'Partage introuvable.']);
            return;
        }

        $this->pageShareModel->updatePermission($pageId, $targetId, $permission);
        $updated = $this->pageShareModel->findByPageAndUser($pageId, $targetId);

        $this->respond(200, ['share' => $updated]);
    }

    // DELETE /api/workspaces/{workspaceId}/pages/{pageId}/shares/{userId}
    public function destroy(array $params): void
    {
        $workspaceId = (int) $params['workspaceId'];
        $pageId      = (int) $params['pageId'];
        $targetId    = (int) $params['userId'];

        $workspace = $this->resolveWorkspaceAccess($workspaceId);
        if ($workspace === null) return;

        $page = $this->resolvePage($pageId, $workspaceId);
        if ($page === null) return;

        $deleted = $this->pageShareModel->delete($pageId, $targetId);
        if (!$deleted) {
            $this->respond(404, ['error' => 'Partage introuvable.']);
            return;
        }

        http_response_code(204);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private function resolveWorkspaceAccess(int $workspaceId): ?array
    {
        $workspace = $this->workspaceModel->findById($workspaceId);

        if ($workspace === null) {
            $this->respond(404, ['error' => 'Workspace introuvable.']);
            return null;
        }

        if (!$this->workspaceModel->userHasAccess($workspaceId, $_SESSION['user_id'])) {
            $this->respond(403, ['error' => 'Accès non autorisé à ce workspace.']);
            return null;
        }

        return $workspace;
    }

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
