<?php
// backend/api/reports/my.php  (GET: ログインユーザー自身の月次レポート履歴)

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

require_once __DIR__ . '/../../config/auth_check.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit();
}

$limit = isset($_GET['limit']) ? max(1, min((int)$_GET['limit'], 120)) : 12;

try {
    $pdo = getDB();

    $stmt = $pdo->prepare(
        'SELECT `year_month`, unilevel_bonus, infinity_bonus, megamatch_bonus,
                pool_bonus, total_bonus, pool_contribution, net_bonus
         FROM monthly_reports
         WHERE user_id = ?
         ORDER BY `year_month` DESC
         LIMIT ?'
    );
    $stmt->bindValue(1, $currentUser['id'], PDO::PARAM_INT);
    $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $result = [];
    foreach ($rows as $row) {
        $result[] = [
            'year_month'        => $row['year_month'],
            'unilevel_bonus'    => (float)$row['unilevel_bonus'],
            'infinity_bonus'    => (float)$row['infinity_bonus'],
            'megamatch_bonus'   => (float)$row['megamatch_bonus'],
            'pool_bonus'        => (float)$row['pool_bonus'],
            'total_bonus'       => (float)$row['total_bonus'],
            'pool_contribution' => (float)$row['pool_contribution'],
            'net_bonus'         => (float)$row['net_bonus'],
        ];
    }

    echo json_encode($result);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
