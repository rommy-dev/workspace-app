<?php

namespace Tests\Integration;

class CollaborationTest extends ApiTestCase
{
    public function test_member_can_access_shared_workspace(): void
    {
        $aliceId = $this->createUser('Alice', 'alice@test.com');
        $wsId    = $this->createWorkspace('Workspace Alice', $aliceId);
        $bobId   = $this->createUser('Bob', 'bob@test.com');

        // Invite Bob
        $this->db->prepare(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
        )->execute([$wsId, $bobId, 'editor']);

        $this->loginAs('bob@test.com', 'motdepasse123');
        $res = $this->request('GET', "/api/workspaces/$wsId", withSession: true);

        $this->assertEquals(200, $res['status']);
    }

    public function test_comment_author_can_edit_own_comment(): void
    {
        $aliceId = $this->createUser('Alice', 'alice@test.com');
        $wsId    = $this->createWorkspace('WS', $aliceId);

        // Crée une page et un commentaire en DB directement
        $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title) VALUES (?, ?, ?)'
        )->execute([$wsId, $aliceId, 'Page test']);
        $pageId = (int) $this->db->lastInsertId();

        $this->db->prepare(
            'INSERT INTO comments (page_id, user_id, content) VALUES (?, ?, ?)'
        )->execute([$pageId, $aliceId, 'Commentaire original']);
        $commentId = (int) $this->db->lastInsertId();

        $this->loginAs('alice@test.com', 'motdepasse123');
        $res = $this->request(
            'PUT',
            "/api/workspaces/$wsId/pages/$pageId/comments/$commentId",
            ['content' => 'Commentaire modifié'],
            withSession: true
        );

        $this->assertEquals(200, $res['status']);
        $this->assertEquals('Commentaire modifié', $res['body']['comment']['content']);
    }

    public function test_non_author_cannot_edit_comment(): void
    {
        $aliceId = $this->createUser('Alice', 'alice@test.com');
        $wsId    = $this->createWorkspace('WS', $aliceId);
        $bobId   = $this->createUser('Bob', 'bob@test.com');

        $this->db->prepare(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
        )->execute([$wsId, $bobId, 'editor']);

        $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title) VALUES (?, ?, ?)'
        )->execute([$wsId, $aliceId, 'Page']);
        $pageId = (int) $this->db->lastInsertId();

        $this->db->prepare(
            'INSERT INTO comments (page_id, user_id, content) VALUES (?, ?, ?)'
        )->execute([$pageId, $aliceId, 'Commentaire d\'Alice']);
        $commentId = (int) $this->db->lastInsertId();

        // Bob essaie de modifier le commentaire d'Alice → 403
        $this->loginAs('bob@test.com', 'motdepasse123');
        $res = $this->request(
            'PUT',
            "/api/workspaces/$wsId/pages/$pageId/comments/$commentId",
            ['content' => 'Tentative'],
            withSession: true
        );

        $this->assertEquals(403, $res['status']);
    }
}