<?php
// auth_check.php
// 前提: session_start() 済み、database.php・cors.php は呼び出し元でinclude済み
// 使い方:
//   $requireAdmin = true;  // 管理者限定にする場合は true をセット（省略可）
//   require_once '../../config/auth_check.php';
// 結果: $currentUser にDBから取得したユーザー情報が入る

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => '認証が必要です']);
    exit();
}

try {
    $pdo  = getDB();
    $stmt = $pdo->prepare(
        'SELECT id, name, email, role, rank, investment_amount, referrer_id
         FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$_SESSION['user_id']]);
    $currentUser = $stmt->fetch();
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
    exit();
}

if (!$currentUser) {
    http_response_code(401);
    echo json_encode(['error' => '認証が必要です']);
    exit();
}

if (!empty($requireAdmin) && !in_array($currentUser['role'], ['root', 'admin'])) {
    http_response_code(403);
    echo json_encode(['error' => '管理者権限が必要です']);
    exit();
}
