<?php
require_once('../../config/cors.php');
require_once('../../config/database.php');

session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit();
}

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => '未認証']);
    exit();
}

try {
    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT id, name, email, role, wallet_address FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        session_destroy();
        http_response_code(401);
        echo json_encode(['error' => '未認証']);
        exit();
    }

    echo json_encode([
        'id'             => $user['id'],
        'name'           => $user['name'],
        'email'          => $user['email'],
        'role'           => $user['role'],
        'wallet_address' => $user['wallet_address'],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
