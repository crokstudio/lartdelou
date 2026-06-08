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
$state = bin2hex(random_bytes(24));
$_SESSION['decap_oauth_state'] = $state;

$scope = isset($_GET['scope']) && is_string($_GET['scope']) ? $_GET['scope'] : 'repo,user';
$query = http_build_query([
    'client_id' => $config['github_client_id'],
    'redirect_uri' => $config['redirect_uri'],
    'scope' => $scope,
    'state' => $state,
]);

header('Location: https://github.com/login/oauth/authorize?' . $query);
exit;
