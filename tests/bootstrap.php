<?php

require_once __DIR__ . '/../vendor/autoload.php';

// Charge le .env de test si présent, sinon le .env standard.
// Certains projets rangent les fichiers .env dans /backend.
$root = realpath(__DIR__ . '/..');
$envCandidates = [
    $root . '/.env.test',
    $root . '/backend/.env.test',
    $root . '/.env',
    $root . '/backend/.env',
];

foreach ($envCandidates as $envFile) {
    if (!file_exists($envFile)) {
        continue;
    }

    $env = parse_ini_file($envFile);
    foreach ($env as $key => $value) {
        putenv("$key=$value");
    }
    break;
}
