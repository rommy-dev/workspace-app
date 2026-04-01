<?php

namespace Controllers;

class TestController
{
    public function ping(array $params): void
    {
        http_response_code(200);
        echo json_encode([
            'status'    => 'ok',
            'timestamp' => date('Y-m-d H:i:s'),
            'php'       => PHP_VERSION,
        ]);
    }
}