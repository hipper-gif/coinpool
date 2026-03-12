<?php
// backend/api/bonus/my.php  (GET: ログインユーザー自身のボーナス取得)

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

require_once __DIR__ . '/../../config/auth_check.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit();
}

try {
    $pdo = getDB();

    $stmt = $pdo->prepare(
        'SELECT unilevel_bonus, infinity_bonus, megamatch_bonus, pool_bonus,
                total_bonus, calculated_at
         FROM bonus_snapshots
         WHERE user_id = ?
         ORDER BY calculated_at DESC
         LIMIT 1'
    );
    $stmt->execute([$currentUser['id']]);
    $snapshot = $stmt->fetch();

    if (!$snapshot) {
        echo json_encode([
            'unilevel_bonus'  => 0.0,
            'infinity_bonus'  => 0.0,
            'megamatch_bonus' => 0.0,
            'pool_bonus'      => 0.0,
            'total_bonus'     => 0.0,
            'calculated_at'   => null,
        ]);
        exit();
    }

    echo json_encode([
        'unilevel_bonus'  => (float)$snapshot['unilevel_bonus'],
        'infinity_bonus'  => (float)$snapshot['infinity_bonus'],
        'megamatch_bonus' => (float)$snapshot['megamatch_bonus'],
        'pool_bonus'      => (float)$snapshot['pool_bonus'],
        'total_bonus'     => (float)$snapshot['total_bonus'],
        'calculated_at'   => $snapshot['calculated_at'],
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
