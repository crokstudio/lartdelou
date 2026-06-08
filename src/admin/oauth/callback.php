<?php

declare(strict_types=1);

session_start();

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    echo 'Missing Decap OAuth config.';
    exit;
}

$config = require $configFile;
$origin = $config['allowed_origin'];

function finish(string $provider, string $status, array $payload, string $origin): void
{
    $message = 'authorization:' . $provider . ':' . $status . ':' . json_encode($payload, JSON_UNESCAPED_SLASHES);
    $encodedMessage = json_encode($message, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);
    $encodedOrigin = json_encode($origin, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);

    header('Content-Type: text/html; charset=UTF-8');
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Decap OAuth</title></head><body>';
    echo '<script>';
    echo 'if (window.opener) { window.opener.postMessage(' . $encodedMessage . ', ' . $encodedOrigin . '); }';
    echo 'window.close();';
    echo '</script>';
    echo '</body></html>';
    exit;
}

$state = isset($_GET['state']) && is_string($_GET['state']) ? $_GET['state'] : '';
$expectedState = isset($_SESSION['decap_oauth_state']) ? (string) $_SESSION['decap_oauth_state'] : '';
unset($_SESSION['decap_oauth_state']);

if ($state === '' || $expectedState === '' || !hash_equals($expectedState, $state)) {
    finish('github', 'error', ['error' => 'Invalid OAuth state.'], $origin);
}

if (isset($_GET['error'])) {
    finish('github', 'error', ['error' => (string) $_GET['error']], $origin);
}

$code = isset($_GET['code']) && is_string($_GET['code']) ? $_GET['code'] : '';
if ($code === '') {
    finish('github', 'error', ['error' => 'Missing OAuth code.'], $origin);
}

$body = http_build_query([
    'client_id' => $config['github_client_id'],
    'client_secret' => $config['github_client_secret'],
    'redirect_uri' => $config['redirect_uri'],
    'code' => $code,
]);

$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => "Accept: application/json\r\nContent-Type: application/x-www-form-urlencoded\r\n",
        'content' => $body,
        'timeout' => 15,
    ],
]);

if (function_exists('curl_init')) {
    $curl = curl_init('https://github.com/login/oauth/access_token');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/x-www-form-urlencoded',
        ],
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($curl);
    curl_close($curl);
} else {
    $response = file_get_contents('https://github.com/login/oauth/access_token', false, $context);
}

if ($response === false) {
    finish('github', 'error', ['error' => 'Unable to exchange OAuth code.'], $origin);
}

$tokenResponse = json_decode($response, true);
if (!is_array($tokenResponse) || empty($tokenResponse['access_token'])) {
    finish('github', 'error', ['error' => $tokenResponse['error_description'] ?? 'Missing access token.'], $origin);
}

finish('github', 'success', [
    'token' => $tokenResponse['access_token'],
    'provider' => 'github',
], $origin);
