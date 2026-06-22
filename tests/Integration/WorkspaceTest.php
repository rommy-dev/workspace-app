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

    public function test_workspaces_are_ordered_by_recent_creation_or_page_update(): void
    {
        $aliceId = $this->createUser('Alice', 'alice@test.com');
        $bobId = $this->createUser('Bob', 'bob@test.com');

        $inactiveWorkspaceId = $this->createWorkspaceWithDate(
            'Ancien inactif',
            $aliceId,
            '2026-01-01 09:00:00'
        );
        $pageUpdatedWorkspaceId = $this->createWorkspaceWithDate(
            'Ancien avec page modifiée',
            $aliceId,
            '2026-01-02 09:00:00'
        );
        $recentWorkspaceId = $this->createWorkspaceWithDate(
            'Workspace créé récemment',
            $aliceId,
            '2026-06-15 09:00:00'
        );
        $memberWorkspaceId = $this->createWorkspaceWithDate(
            'Workspace membre actif',
            $bobId,
            '2026-01-03 09:00:00'
        );

        $this->createPageWithDates(
            $pageUpdatedWorkspaceId,
            $aliceId,
            'Page modifiée',
            '2026-01-03 09:00:00',
            '2026-06-10 09:00:00'
        );
        $this->createPageWithDates(
            $memberWorkspaceId,
            $bobId,
            'Page membre modifiée',
            '2026-01-04 09:00:00',
            '2026-06-20 09:00:00'
        );
        $this->db->prepare(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
        )->execute([$memberWorkspaceId, $aliceId, 'viewer']);

        $this->loginAs('alice@test.com', 'motdepasse123');

        $res = $this->request('GET', '/api/workspaces', withSession: true);

        $this->assertEquals(200, $res['status']);
        $this->assertSame(
            [$memberWorkspaceId, $recentWorkspaceId, $pageUpdatedWorkspaceId, $inactiveWorkspaceId],
            array_map('intval', array_column($res['body']['workspaces'], 'id'))
        );
        $this->assertSame('2026-06-20 09:00:00', $res['body']['workspaces'][0]['last_activity']);
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

    private function createWorkspaceWithDate(string $name, int $ownerId, string $createdAt): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO workspaces (name, owner_id, created_at) VALUES (?, ?, ?)'
        );
        $stmt->execute([$name, $ownerId, $createdAt]);

        return (int) $this->db->lastInsertId();
    }

    private function createPageWithDates(
        int $workspaceId,
        int $ownerId,
        string $title,
        string $createdAt,
        string $updatedAt
    ): int {
        $stmt = $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$workspaceId, $ownerId, $title, $createdAt, $updatedAt]);

        return (int) $this->db->lastInsertId();
    }
}
