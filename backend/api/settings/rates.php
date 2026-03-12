<?php
// backend/api/settings/rates.php  (GET: ボーナス率一覧 — 認証ユーザー全員閲覧可)

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

    $stmt = $pdo->query('SELECT level, rate FROM unilevel_rates ORDER BY level ASC');
    $unilevel = [];
    foreach ($stmt->fetchAll() as $row) {
        $unilevel[] = [
            'level' => (int)$row['level'],
            'rate'  => (float)$row['rate'],
        ];
    }

    $stmt = $pdo->query(
        'SELECT rank, infinity_rate, megamatch_same_rate, megamatch_upper_rate,
                pool_distribution_rate, pool_contribution_rate,
                mm_min_investment, mm_min_direct_referrals, mm_min_group_investment
         FROM rank_conditions ORDER BY min_investment ASC'
    );
    $ranks = [];
    foreach ($stmt->fetchAll() as $row) {
        $ranks[$row['rank']] = [
            'infinity_rate'          => (float)$row['infinity_rate'],
            'megamatch_same_rate'    => (float)$row['megamatch_same_rate'],
            'megamatch_upper_rate'   => (float)$row['megamatch_upper_rate'],
            'pool_distribution_rate' => (float)$row['pool_distribution_rate'],
            'pool_contribution_rate' => (float)$row['pool_contribution_rate'],
        ];
    }

    echo json_encode([
        'unilevel_rates'  => $unilevel,
        'rank_conditions' => $ranks,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
