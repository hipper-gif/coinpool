<?php
// backend/api/bonus/rights.php  (GET: 配当権一覧)
// 管理者のみ

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

$requireAdmin = true;
require_once __DIR__ . '/../../config/auth_check.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit();
}

try {
    $pdo = getDB();

    // 全メンバー（root除外）の投資額合計 → 発生収益を算出
    $stmt = $pdo->query(
        "SELECT COALESCE(SUM(investment_amount), 0) AS total_investment
         FROM users WHERE role != 'root'"
    );
    $totalInvestment = (float)$stmt->fetch()['total_investment'];
    $totalRevenue    = $totalInvestment * 0.05; // 基準収益率 5%

    // 全メンバー + ボーナススナップショット
    $stmt = $pdo->query(
        "SELECT u.id, u.name, u.email, u.rank, u.investment_amount, u.wallet_address,
                COALESCE(bs.unilevel_bonus, 0)  AS unilevel_bonus,
                COALESCE(bs.infinity_bonus, 0)  AS infinity_bonus,
                COALESCE(bs.megamatch_bonus, 0) AS megamatch_bonus,
                COALESCE(bs.pool_bonus, 0)      AS pool_bonus,
                COALESCE(bs.total_bonus, 0)     AS total_bonus
         FROM users u
         LEFT JOIN bonus_snapshots bs ON bs.user_id = u.id
         WHERE u.role != 'root'
         ORDER BY COALESCE(bs.total_bonus, 0) DESC"
    );
    $members = $stmt->fetchAll();

    $result = [];
    foreach ($members as $m) {
        $totalBonus = (float)$m['total_bonus'];

        // 発生収益に対する実効%を算出
        if ($totalRevenue > 0) {
            $unilevelPct  = (float)$m['unilevel_bonus']  / $totalRevenue * 100;
            $infinityPct  = (float)$m['infinity_bonus']  / $totalRevenue * 100;
            $megamatchPct = (float)$m['megamatch_bonus'] / $totalRevenue * 100;
            $poolPct      = (float)$m['pool_bonus']      / $totalRevenue * 100;
            $totalPct     = $totalBonus / $totalRevenue * 100;
        } else {
            $unilevelPct = $infinityPct = $megamatchPct = $poolPct = $totalPct = 0.0;
        }

        $result[] = [
            'id'              => (int)$m['id'],
            'name'            => $m['name'],
            'email'           => $m['email'],
            'rank'            => $m['rank'],
            'wallet_address'  => $m['wallet_address'],
            'investment'      => (float)$m['investment_amount'],
            'unilevel_pct'    => round($unilevelPct, 4),
            'infinity_pct'    => round($infinityPct, 4),
            'megamatch_pct'   => round($megamatchPct, 4),
            'pool_pct'        => round($poolPct, 4),
            'total_pct'       => round($totalPct, 4),
            'total_bonus'     => round($totalBonus, 2),
        ];
    }

    echo json_encode([
        'total_investment' => round($totalInvestment, 2),
        'total_revenue'    => round($totalRevenue, 2),
        'members'          => $result,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
