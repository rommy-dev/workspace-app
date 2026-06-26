<?php

namespace Controllers;

use Models\ProfileModel;

class ProfileController
{
    private ProfileModel $profileModel;

    public function __construct()
    {
        $this->profileModel = new ProfileModel();
    }

    // GET /api/users/{id} — Récupère le profil public d'un utilisateur
    public function show(array $params): void
    {
        $id = $params['id'] ?? null;

        if (!$id || !is_numeric($id)) {
            $this->respond(400, ['error' => 'ID utilisateur invalide.']);
            return;
        }

        $user = $this->profileModel->findPublicById((int) $id);

        if ($user === null) {
            $this->respond(404, ['error' => 'Utilisateur introuvable.']);
            return;
        }

        $this->respond(200, ['user' => $user]);
    }

    // GET /api/profile — Récupère le profil de l'utilisateur courant (protégé)
    public function me(array $params): void
    {
        $userId = $_SESSION['user_id'] ?? null;

        if (!$userId) {
            $this->respond(401, ['error' => 'Non authentifié.']);
            return;
        }

        $user = $this->profileModel->findPublicById($userId);

        if ($user === null) {
            $this->respond(404, ['error' => 'Utilisateur introuvable.']);
            return;
        }

        $this->respond(200, ['user' => $user]);
    }

    // PUT /api/profile — Met à jour le profil de l'utilisateur courant (protégé)
    public function update(array $params): void
    {
        $userId = $_SESSION['user_id'] ?? null;

        if (!$userId) {
            $this->respond(401, ['error' => 'Non authentifié.']);
            return;
        }

        $body = $this->getJsonBody();
        $errors = [];

        // Validation name
        if (empty($body['name']) || strlen(trim($body['name'])) < 2) {
            $errors['name'] = 'Le nom doit faire au moins 2 caractères.';
        }

        // Validation email
        if (empty($body['email'])) {
            $errors['email'] = 'L\'email est requis.';
        } elseif (!filter_var($body['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Format d\'email invalide.';
        }

        // Vérifier l'unicité de l'email (excluant l'utilisateur courant)
        if (empty($errors['email']) && $this->profileModel->emailExistsForOtherUser($body['email'], $userId)) {
            $errors['email'] = 'Cet email est déjà utilisé.';
        }

        if (!empty($errors)) {
            $this->respond(422, ['errors' => $errors]);
            return;
        }

        // Mise à jour
        if ($this->profileModel->updateProfile(
            $userId,
            trim($body['name']),
            strtolower(trim($body['email']))
        )) {
            // Récupérer le profil mis à jour
            $user = $this->profileModel->findPublicById($userId);
            $this->respond(200, [
                'message' => 'Profil mis à jour avec succès.',
                'user'    => $user,
            ]);
        } else {
            $this->respond(500, ['error' => 'Erreur lors de la mise à jour du profil.']);
        }
    }

    // PUT /api/profile/avatar — Upload un fichier avatar (multipart/form-data)
    public function uploadAvatar(array $params): void
    {
        $userId = $_SESSION['user_id'] ?? null;

        if (!$userId) {
            $this->respond(401, ['error' => 'Non authentifié.']);
            return;
        }

        // Vérifier que le fichier a été téléchargé
        if (!isset($_FILES['avatar']) || $_FILES['avatar']['error'] !== UPLOAD_ERR_OK) {
            $this->respond(400, ['error' => 'Aucun fichier téléchargé.']);
            return;
        }

        $file = $_FILES['avatar'];
        $errors = [];

        // Validation taille (max 5MB)
        $maxSize = 5 * 1024 * 1024;
        if ($file['size'] > $maxSize) {
            $errors['avatar'] = 'L\'image ne doit pas dépasser 5MB.';
        }

        // Validation type MIME
        $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedMimes)) {
            $errors['avatar'] = 'Format d\'image invalide. Utilisez JPG, PNG, GIF ou WebP.';
        }

        if (!empty($errors)) {
            $this->respond(422, ['errors' => $errors]);
            return;
        }

        // Générer un nom de fichier unique et sûr
        $ext = match($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            default => 'jpg',
        };

        $filename = 'user_' . $userId . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
        $uploadDir = __DIR__ . '/../../public/avatars/';
        $uploadPath = $uploadDir . $filename;

        // Créer le dossier s'il n'existe pas
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Vérifier que le dossier est accessible en écriture
        if (!is_writable($uploadDir)) {
            $this->respond(500, ['error' => 'Dossier d\'upload non accessible (permissions manquantes).', 'path' => $uploadDir, 'mode'=>substr(sprintf('%o', fileperms($uploadDir)), -4)]);
            return;
        }

        // Déplacer le fichier uploaded
        if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
            $this->respond(500, ['error' => 'Erreur lors du téléchargement du fichier. Vérifiez permissions et détachement du dossier.']);
            return;
        }

        // Récupérer l'ancien avatar pour le supprimer
        $user = $this->profileModel->findPublicById($userId);
        if ($user && $user['avatar_url'] && strpos($user['avatar_url'], 'avatars/') !== false) {
            $oldPath = $uploadDir . basename($user['avatar_url']);
            if (is_file($oldPath)) {
                unlink($oldPath);
            }
        }

        // Sauvegarder le chemin relatif en base de données
        $avatarRelativePath = 'avatars/' . $filename;
        if ($this->profileModel->updateAvatarUrl($userId, $avatarRelativePath)) {
            $updatedUser = $this->profileModel->findPublicById($userId);
            $this->respond(200, [
                'message' => 'Avatar téléchargé avec succès.',
                'user'    => $updatedUser,
            ]);
        } else {
            $this->respond(500, ['error' => 'Erreur lors de la sauvegarde du profil.']);
        }
    }

    // PUT /api/profile/password — Change le mot de passe de l'utilisateur courant (protégé)
    public function updatePassword(array $params): void
    {
        $userId = $_SESSION['user_id'] ?? null;

        if (!$userId) {
            $this->respond(401, ['error' => 'Non authentifié.']);
            return;
        }

        $body = $this->getJsonBody();
        $errors = [];

        // Vérification que les champs requis sont présents
        if (empty($body['current_password'])) {
            $errors['current_password'] = 'Le mot de passe actuel est requis.';
        }

        if (empty($body['new_password'])) {
            $errors['new_password'] = 'Le nouveau mot de passe est requis.';
        } elseif (strlen($body['new_password']) < 8) {
            $errors['new_password'] = 'Le mot de passe doit faire au moins 8 caractères.';
        }

        if (!empty($errors)) {
            $this->respond(422, ['errors' => $errors]);
            return;
        }

        // Récupérer l'utilisateur avec le hash
        $user = $this->profileModel->findById($userId);

        if ($user === null) {
            $this->respond(404, ['error' => 'Utilisateur introuvable.']);
            return;
        }

        // Vérifier le mot de passe courant
        if (!password_verify($body['current_password'], $user['password_hash'])) {
            $this->respond(401, ['error' => 'Mot de passe actuel incorrect.']);
            return;
        }

        // Hasher le nouveau mot de passe
        $newHash = password_hash($body['new_password'], PASSWORD_BCRYPT);

        // Mettre à jour
        if ($this->profileModel->updatePassword($userId, $newHash)) {
            $this->respond(200, [
                'message' => 'Mot de passe mis à jour avec succès.',
            ]);
        } else {
            $this->respond(500, ['error' => 'Erreur lors de la mise à jour du mot de passe.']);
        }
    }

    // ── Helpers privés ──────────────────────────────────────────────

    private function getJsonBody(): array
    {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        return is_array($data) ? $data : [];
    }

    private function respond(int $status, array $data): void
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
    }
}
