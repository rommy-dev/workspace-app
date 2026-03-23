<?php

namespace Controllers;

use Models\MemberModel;
use Models\WorkspaceModel;
use Models\User;

class MemberController
{
    private MemberModel    $memberModel;
    private WorkspaceModel $workspaceModel;
    private User           $userModel;

    public function __construct()
    {
        $this->memberModel    = new MemberModel();
        $this->workspaceModel = new WorkspaceModel();
        $this->userModel      = new User();
    }

    // GET /api/workspaces/{id}/members
    public function index(array $params): void
    {
        $workspace = $this->resolveWorkspace((int) $params['id']);
        if ($workspace === null) return;

        $members = $this->memberModel->findAllByWorkspace((int) $params['id']);
        $this->respond(200, ['members' => $members]);
    }

    // POST /api/workspaces/{id}/members
    // Body : { "email": "bob@test.com", "role": "editor" }
    public function store(array $params): void
    {
        $workspace = $this->resolveWorkspace((int) $params['id']);
        if ($workspace === null) return;

        $userId      = $_SESSION['user_id'];
        $workspaceId = (int) $params['id'];

        // Seuls owner et admin peuvent inviter
        $isOwner = (int) $workspace['owner_id'] === $userId;
        $membership = $this->memberModel->getMembership($workspaceId, $userId);
        $isAdmin    = $membership && $membership['role'] === 'admin';

        if (!$isOwner && !$isAdmin) {
            $this->respond(403, ['error' => 'Seuls le propriétaire et les admins peuvent inviter des membres.']);
            return;
        }

        $body = $this->getJsonBody();

        // Validation
        if (empty($body['email'])) {
            $this->respond(422, ['errors' => ['email' => 'L\'email est requis.']]);
            return;
        }

        $validRoles = ['viewer', 'editor', 'admin'];
        $role = $body['role'] ?? 'viewer';
        if (!in_array($role, $validRoles, true)) {
            $this->respond(422, ['errors' => ['role' => 'Rôle invalide. Valeurs : viewer, editor, admin.']]);
            return;
        }

        // Trouver le user à inviter par email
        $target = $this->userModel->findByEmail(strtolower(trim($body['email'])));
        if ($target === null) {
            $this->respond(404, ['error' => 'Aucun utilisateur trouvé avec cet email.']);
            return;
        }

        // Ne pas s'inviter soi-même
        if ($target['id'] === $userId) {
            $this->respond(409, ['error' => 'Vous êtes déjà propriétaire ou membre de ce workspace.']);
            return;
        }

        // Vérifier si le user est déjà l'owner
        if ((int) $workspace['owner_id'] === (int) $target['id']) {
            $this->respond(409, ['error' => 'Cet utilisateur est le propriétaire du workspace.']);
            return;
        }

        // Vérifier si déjà membre
        $existing = $this->memberModel->getMembership($workspaceId, (int) $target['id']);
        if ($existing !== null) {
            $this->respond(409, ['error' => 'Cet utilisateur est déjà membre du workspace.']);
            return;
        }

        $this->memberModel->add($workspaceId, (int) $target['id'], $role);

        $members = $this->memberModel->findAllByWorkspace($workspaceId);
        $this->respond(201, ['members' => $members]);
    }

    // DELETE /api/workspaces/{id}/members/{userId}
    public function destroy(array $params): void
    {
        $workspace = $this->resolveWorkspace((int) $params['id']);
        if ($workspace === null) return;

        $currentUserId = $_SESSION['user_id'];
        $targetUserId  = (int) $params['userId'];
        $workspaceId   = (int) $params['id'];

        // On ne peut pas retirer l'owner
        if ((int) $workspace['owner_id'] === $targetUserId) {
            $this->respond(403, ['error' => 'Impossible de retirer le propriétaire du workspace.']);
            return;
        }

        $isOwner    = (int) $workspace['owner_id'] === $currentUserId;
        $membership = $this->memberModel->getMembership($workspaceId, $currentUserId);
        $isAdmin    = $membership && $membership['role'] === 'admin';
        // Un membre peut se retirer lui-même
        $isSelf     = $currentUserId === $targetUserId;

        if (!$isOwner && !$isAdmin && !$isSelf) {
            $this->respond(403, ['error' => 'Action non autorisée.']);
            return;
        }

        $removed = $this->memberModel->remove($workspaceId, $targetUserId);
        if (!$removed) {
            $this->respond(404, ['error' => 'Ce membre est introuvable dans ce workspace.']);
            return;
        }

        http_response_code(204);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private function resolveWorkspace(int $id): ?array
    {
        $workspace = $this->workspaceModel->findById($id);

        if ($workspace === null) {
            $this->respond(404, ['error' => 'Workspace introuvable.']);
            return null;
        }

        if (!$this->workspaceModel->userHasAccess($id, $_SESSION['user_id'])) {
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
