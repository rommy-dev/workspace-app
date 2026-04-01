<?php

namespace Tests\Integration;

class WorkspaceTest extends ApiTestCase
{
    public function test_create_workspace_returns_201(): void
    {
        $this->createUser('Alice', 'alice@test.com');
        $this->loginAs('alice@test.com', 'motdepasse123');

        $res = $this->request('POST', '/api/workspaces', [
            'name' => 'Mon workspace',
        ], withSession: true);

        $this->assertEquals(201, $res['status']);
        $this->assertEquals('Mon workspace', $res['body']['workspace']['name']);
    }

    public function test_create_workspace_fails_without_auth(): void
    {
        $res = $this->request('POST', '/api/workspaces', ['name' => 'Test']);

        $this->assertEquals(401, $res['status']);
    }

    public function test_create_workspace_fails_with_short_name(): void
    {
        $this->createUser('Alice', 'alice@test.com');
        $this->loginAs('alice@test.com', 'motdepasse123');

        $res = $this->request('POST', '/api/workspaces', ['name' => 'A'], withSession: true);

        $this->assertEquals(422, $res['status']);
    }

    public function test_user_cannot_access_another_users_workspace(): void
    {
        $aliceId = $this->createUser('Alice', 'alice@test.com');
        $wsId    = $this->createWorkspace('Workspace Alice', $aliceId);

        // Bob se connecte et tente d'accéder au workspace d'Alice
        $this->createUser('Bob', 'bob@test.com');
        $this->loginAs('bob@test.com', 'motdepasse123');

        $res = $this->request('GET', "/api/workspaces/$wsId", withSession: true);

        $this->assertEquals(403, $res['status']);
    }

    public function test_only_owner_can_delete_workspace(): void
    {
        $aliceId = $this->createUser('Alice', 'alice@test.com');
        $wsId    = $this->createWorkspace('Workspace Alice', $aliceId);

        // Ajoute Bob comme membre
        $bobId = $this->createUser('Bob', 'bob@test.com');
        $this->db->prepare(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
        )->execute([$wsId, $bobId, 'editor']);

        // Bob (membre) essaie de supprimer → 403
        $this->loginAs('bob@test.com', 'motdepasse123');
        $res = $this->request('DELETE', "/api/workspaces/$wsId", withSession: true);
        $this->assertEquals(403, $res['status']);

        // Vérifie que le workspace existe toujours en DB
        $stmt = $this->db->prepare('SELECT id FROM workspaces WHERE id = ?');
        $stmt->execute([$wsId]);
        $this->assertNotNull($stmt->fetch());
    }

    public function test_nonexistent_workspace_returns_404(): void
    {
        $this->createUser('Alice', 'alice@test.com');
        $this->loginAs('alice@test.com', 'motdepasse123');

        $res = $this->request('GET', '/api/workspaces/99999', withSession: true);

        $this->assertEquals(404, $res['status']);
    }
}