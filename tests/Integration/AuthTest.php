<?php

namespace Tests\Integration;

class AuthTest extends ApiTestCase
{
    // ── Inscription ──────────────────────────────────────────────

    public function test_register_creates_user_and_returns_201(): void
    {
        $res = $this->request('POST', '/api/auth/register', [
            'name'     => 'Alice',
            'email'    => 'alice@test.com',
            'password' => 'motdepasse123',
        ]);

        $this->assertEquals(201, $res['status']);
        $this->assertArrayHasKey('user', $res['body']);
        $this->assertEquals('alice@test.com', $res['body']['user']['email']);
        $this->assertArrayNotHasKey('password_hash', $res['body']['user']);
    }

    public function test_register_fails_with_duplicate_email(): void
    {
        $this->createUser('Alice', 'alice@test.com');

        $res = $this->request('POST', '/api/auth/register', [
            'name'     => 'Alice2',
            'email'    => 'alice@test.com',
            'password' => 'motdepasse123',
        ]);

        $this->assertEquals(409, $res['status']);
        $this->assertArrayHasKey('errors', $res['body']);
    }

    public function test_register_fails_with_invalid_data(): void
    {
        $res = $this->request('POST', '/api/auth/register', [
            'name'     => 'A',          // trop court
            'email'    => 'pasvalide',  // format invalide
            'password' => 'court',      // trop court
        ]);

        $this->assertEquals(422, $res['status']);
        $this->assertArrayHasKey('email',    $res['body']['errors']);
        $this->assertArrayHasKey('name',     $res['body']['errors']);
        $this->assertArrayHasKey('password', $res['body']['errors']);
    }

    // ── Connexion ────────────────────────────────────────────────

    public function test_login_succeeds_with_correct_credentials(): void
    {
        $this->createUser('Alice', 'alice@test.com');

        $res = $this->request('POST', '/api/auth/login', [
            'email'    => 'alice@test.com',
            'password' => 'motdepasse123',
        ]);

        $this->assertEquals(200, $res['status']);
        $this->assertEquals('Alice', $res['body']['user']['name']);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $this->createUser('Alice', 'alice@test.com');

        $res = $this->request('POST', '/api/auth/login', [
            'email'    => 'alice@test.com',
            'password' => 'mauvais',
        ]);

        $this->assertEquals(401, $res['status']);
        // Le message ne doit PAS préciser si c'est l'email ou le mot de passe
        $this->assertStringNotContainsStringIgnoringCase('email', $res['body']['error']);
        $this->assertStringNotContainsStringIgnoringCase('mot de passe', $res['body']['error']);
    }

    public function test_login_fails_with_unknown_email(): void
    {
        $res = $this->request('POST', '/api/auth/login', [
            'email'    => 'inconnu@test.com',
            'password' => 'motdepasse123',
        ]);

        $this->assertEquals(401, $res['status']);
    }

    // ── Routes protégées ────────────────────────────────────────

    public function test_protected_route_returns_401_without_session(): void
    {
        $res = $this->request('GET', '/api/auth/me');

        $this->assertEquals(401, $res['status']);
    }

    public function test_me_returns_user_when_authenticated(): void
    {
        $this->createUser('Alice', 'alice@test.com');
        $this->loginAs('alice@test.com', 'motdepasse123');

        $res = $this->request('GET', '/api/auth/me', withSession: true);

        $this->assertEquals(200, $res['status']);
        $this->assertEquals('Alice', $res['body']['user']['name']);
    }
}