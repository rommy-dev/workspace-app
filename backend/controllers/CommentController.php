<?php

namespace Controllers;

use Models\CommentModel;
use Models\WorkspaceModel;
use Models\PageModel;

class CommentController
{
    private CommentModel   $commentModel;
    private WorkspaceModel $workspaceModel;
    private PageModel      $pageModel;

    public function __construct()
    {
        $this->commentModel   = new CommentModel();
        $this->workspaceModel = new WorkspaceModel();
        $this->pageModel      = new PageModel();
    }

    // GET /api/workspaces/{workspaceId}/pages/{pageId}/comments
    public function index(array $params): void
    {
        if (!$this->resolveAccess($params)) return;

        $comments = $this->commentModel->findAllByPage((int) $params['pageId']);
        $this->respond(200, ['comments' => $comments]);
    }

    // POST /api/workspaces/{workspaceId}/pages/{pageId}/comments
    public function store(array $params): void
    {
        if (!$this->resolveAccess($params)) return;

        $body = $this->getJsonBody();

        if (empty($body['content']) || strlen(trim($body['content'])) < 1) {
            $this->respond(422, ['errors' => ['content' => 'Le contenu est requis.']]);
            return;
        }

        $id      = $this->commentModel->create(
            (int) $params['pageId'],
            $_SESSION['user_id'],
            trim($body['content'])
        );
        $comment = $this->commentModel->findById($id);

        $this->respond(201, ['comment' => $comment]);
    }

    // PUT /api/workspaces/{workspaceId}/pages/{pageId}/comments/{id}
    public function update(array $params): void
    {
        if (!$this->resolveAccess($params)) return;

        $comment = $this->commentModel->findById((int) $params['id']);

        if ($comment === null || (int) $comment['page_id'] !== (int) $params['pageId']) {
            $this->respond(404, ['error' => 'Commentaire introuvable.']);
            return;
        }

        // Seul l'auteur peut modifier son commentaire
        if ((int) $comment['user_id'] !== $_SESSION['user_id']) {
            $this->respond(403, ['error' => 'Seul l\'auteur peut modifier ce commentaire.']);
            return;
        }

        $body = $this->getJsonBody();

        if (empty($body['content']) || strlen(trim($body['content'])) < 1) {
            $this->respond(422, ['errors' => ['content' => 'Le contenu est requis.']]);
            return;
        }

        $this->commentModel->update((int) $params['id'], trim($body['content']));
        $updated = $this->commentModel->findById((int) $params['id']);

        $this->respond(200, ['comment' => $updated]);
    }

    // DELETE /api/workspaces/{workspaceId}/pages/{pageId}/comments/{id}
    public function destroy(array $params): void
    {
        if (!$this->resolveAccess($params)) return;

        $comment = $this->commentModel->findById((int) $params['id']);

        if ($comment === null || (int) $comment['page_id'] !== (int) $params['pageId']) {
            $this->respond(404, ['error' => 'Commentaire introuvable.']);
            return;
        }

        $userId      = $_SESSION['user_id'];
        $workspaceId = (int) $params['workspaceId'];
        $workspace   = $this->workspaceModel->findById($workspaceId);

        // L'auteur du commentaire OU l'owner du workspace peut supprimer
        $isAuthor  = (int) $comment['user_id'] === $userId;
        $isOwner   = (int) $workspace['owner_id'] === $userId;

        if (!$isAuthor && !$isOwner) {
            $this->respond(403, ['error' => 'Action non autorisée.']);
            return;
        }

        $this->commentModel->delete((int) $params['id']);
        http_response_code(204);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    // Vérifie workspace + accès + page dans l'ordre correct
    private function resolveAccess(array $params): bool
    {
        $workspaceId = (int) $params['workspaceId'];
        $pageId      = (int) $params['pageId'];

        $workspace = $this->workspaceModel->findById($workspaceId);
        if ($workspace === null) {
            $this->respond(404, ['error' => 'Workspace introuvable.']);
            return false;
        }

        if (!$this->workspaceModel->userHasAccess($workspaceId, $_SESSION['user_id'])) {
            $this->respond(403, ['error' => 'Accès non autorisé à ce workspace.']);
            return false;
        }

        $page = $this->pageModel->findById($pageId);
        if ($page === null || (int) $page['workspace_id'] !== $workspaceId) {
            $this->respond(404, ['error' => 'Page introuvable.']);
            return false;
        }

        return true;
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
