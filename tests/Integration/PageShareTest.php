<?php

namespace Tests\Integration;

class PageShareTest extends ApiTestCase
{
    public function test_viewer_can_create_share(): void
    {
        $ownerId    = $this->createUser('Owner', 'owner@test.com');
        $viewerId   = $this->createUser('Viewer', 'viewer@test.com');
        $externalId = $this->createUser('Ext', 'ext@test.com');
        $wsId       = $this->createWorkspace('WS', $ownerId);

        $this->db->prepare(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
        )->execute([$wsId, $viewerId, 'viewer']);

        $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title) VALUES (?, ?, ?)'
        )->execute([$wsId, $ownerId, 'Page']);
        $pageId = (int) $this->db->lastInsertId();

        $this->loginAs('viewer@test.com', 'motdepasse123');
        $res = $this->request(
            'POST',
            "/api/workspaces/$wsId/pages/$pageId/shares",
            ['email' => 'ext@test.com', 'permission' => 'read'],
            withSession: true
        );

        $this->assertEquals(201, $res['status']);
        $this->assertEquals('read', $res['body']['share']['permission']);
        $this->assertEquals('ext@test.com', $res['body']['share']['email']);
    }

    public function test_non_member_cannot_access_page_without_share(): void
    {
        $ownerId = $this->createUser('Owner', 'owner@test.com');
        $wsId    = $this->createWorkspace('WS', $ownerId);
        $this->createUser('Bob', 'bob@test.com');

        $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title) VALUES (?, ?, ?)'
        )->execute([$wsId, $ownerId, 'Page']);
        $pageId = (int) $this->db->lastInsertId();

        $this->loginAs('bob@test.com', 'motdepasse123');
        $res = $this->request('GET', "/api/workspaces/$wsId/pages/$pageId", withSession: true);

        $this->assertEquals(403, $res['status']);
    }

    public function test_read_share_allows_view_but_not_edit(): void
    {
        $ownerId    = $this->createUser('Owner', 'owner@test.com');
        $externalId = $this->createUser('Ext', 'ext@test.com');
        $wsId       = $this->createWorkspace('WS', $ownerId);

        $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title, content) VALUES (?, ?, ?, ?)'
        )->execute([$wsId, $ownerId, 'Page', 'Contenu']);
        $pageId = (int) $this->db->lastInsertId();

        $this->db->prepare(
            'INSERT INTO page_shares (page_id, user_id, permission) VALUES (?, ?, ?)'
        )->execute([$pageId, $externalId, 'read']);

        $this->loginAs('ext@test.com', 'motdepasse123');

        $resView = $this->request('GET', "/api/workspaces/$wsId/pages/$pageId", withSession: true);
        $this->assertEquals(200, $resView['status']);

        $resEdit = $this->request(
            'PUT',
            "/api/workspaces/$wsId/pages/$pageId",
            ['title' => 'Nouveau', 'content' => 'Update'],
            withSession: true
        );
        $this->assertEquals(403, $resEdit['status']);
    }

    public function test_edit_share_allows_update(): void
    {
        $ownerId    = $this->createUser('Owner', 'owner@test.com');
        $externalId = $this->createUser('Ext', 'ext@test.com');
        $wsId       = $this->createWorkspace('WS', $ownerId);

        $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title, content) VALUES (?, ?, ?, ?)'
        )->execute([$wsId, $ownerId, 'Page', 'Contenu']);
        $pageId = (int) $this->db->lastInsertId();

        $this->db->prepare(
            'INSERT INTO page_shares (page_id, user_id, permission) VALUES (?, ?, ?)'
        )->execute([$pageId, $externalId, 'edit']);

        $this->loginAs('ext@test.com', 'motdepasse123');

        $res = $this->request(
            'PUT',
            "/api/workspaces/$wsId/pages/$pageId",
            ['title' => 'Page modifiée', 'content' => 'Nouveau contenu'],
            withSession: true
        );

        $this->assertEquals(200, $res['status']);
        $this->assertEquals('Page modifiée', $res['body']['page']['title']);
    }

    public function test_share_validation_conflicts(): void
    {
        $ownerId    = $this->createUser('Owner', 'owner@test.com');
        $memberId   = $this->createUser('Member', 'member@test.com');
        $externalId = $this->createUser('Ext', 'ext@test.com');
        $wsId       = $this->createWorkspace('WS', $ownerId);

        $this->db->prepare(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)'
        )->execute([$wsId, $memberId, 'viewer']);

        $this->db->prepare(
            'INSERT INTO pages (workspace_id, owner_id, title) VALUES (?, ?, ?)'
        )->execute([$wsId, $ownerId, 'Page']);
        $pageId = (int) $this->db->lastInsertId();

        $this->loginAs('owner@test.com', 'motdepasse123');

        $resMissing = $this->request(
            'POST',
            "/api/workspaces/$wsId/pages/$pageId/shares",
            ['email' => 'inconnu@test.com', 'permission' => 'read'],
            withSession: true
        );
        $this->assertEquals(404, $resMissing['status']);

        $resMember = $this->request(
            'POST',
            "/api/workspaces/$wsId/pages/$pageId/shares",
            ['email' => 'member@test.com', 'permission' => 'read'],
            withSession: true
        );
        $this->assertEquals(409, $resMember['status']);

        $this->db->prepare(
            'INSERT INTO page_shares (page_id, user_id, permission) VALUES (?, ?, ?)'
        )->execute([$pageId, $externalId, 'read']);

        $resAlreadyShared = $this->request(
            'POST',
            "/api/workspaces/$wsId/pages/$pageId/shares",
            ['email' => 'ext@test.com', 'permission' => 'read'],
            withSession: true
        );
        $this->assertEquals(409, $resAlreadyShared['status']);
    }
}
