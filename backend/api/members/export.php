<?php
// backend/api/members/export.php  (GET: メンバーデータCSVエクスポート)
// 管理者のみ

session_start();
require_once __DIR__ . '/../../config/database.php';

$requireAdmin = true;
require_once __DIR__ . '/../../config/auth_check.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit();
}

// ---------------------------------------------------------------
// ヘルパー: 全ユーザーを取得して親→子マップを構築
// ---------------------------------------------------------------
function buildChildrenMapForExport(PDO $pdo): array
{
    $stmt = $pdo->query('SELECT id, referrer_id FROM users');
    $rows = $stmt->fetchAll();
    $map  = [];
    foreach ($rows as $row) {
        if ($row['referrer_id'] !== null) {
            $map[(int)$row['referrer_id']][] = (int)$row['id'];
        }
    }
    return $map;
}

// ---------------------------------------------------------------
// ヘルパー: 傘下全員の investment_amount を再帰的に合計する
// ---------------------------------------------------------------
function calcGroupInvestmentForExport(int $userId, array $childrenMap, PDO $pdo): float
{
    $stmt = $pdo->prepare('SELECT investment_amount FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();
    $sum  = (float)($row['investment_amount'] ?? 0);

    if (!empty($childrenMap[$userId])) {
        foreach ($childrenMap[$userId] as $childId) {
            $sum += calcGroupInvestmentForExport($childId, $childrenMap, $pdo);
        }
    }
    return $sum;
}

try {
    $pdo = getDB();

    // 全ユーザー取得（root除外）
    $stmt = $pdo->prepare(
        "SELECT u.id, u.name, u.email, u.rank,
                u.investment_amount, u.wallet_address, u.created_at,
                (SELECT COUNT(*) FROM users c WHERE c.referrer_id = u.id) AS direct_referral_count
         FROM users u
         WHERE u.role NOT IN (:role, 'pool')
         ORDER BY u.id ASC"
    );
    $stmt->execute([':role' => 'root']);
    $users = $stmt->fetchAll();

    $childrenMap = buildChildrenMapForExport($pdo);

    // ボーナススナップショットを一括取得（最新のもの）
    $bonusStmt = $pdo->prepare(
        'SELECT user_id, unilevel_bonus, infinity_bonus, megamatch_bonus,
                pool_bonus, total_bonus
         FROM bonus_snapshots
         WHERE user_id = ?
         ORDER BY calculated_at DESC
         LIMIT 1'
    );

    // CSVヘッダー送出
    $filename = 'coinpool_members_' . date('Ymd') . '.csv';
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');

    $output = fopen('php://output', 'w');

    // BOM付きUTF-8（Excelで文字化けしないように）
    fwrite($output, "\xEF\xBB\xBF");

    // CSV列ヘッダー
    fputcsv($output, [
        'ID',
        '名前',
        'メールアドレス',
        'ウォレットアドレス',
        'ランク',
        '運用額',
        '直紹介数',
        'グループ運用額',
        'ユニレベルボーナス',
        'インフィニティボーナス',
        'メガマッチボーナス',
        'プールボーナス',
        '合計ボーナス',
        '登録日',
    ]);

    // データ行
    foreach ($users as $user) {
        $userId = (int)$user['id'];

        // グループ運用額
        $groupInvestment = calcGroupInvestmentForExport($userId, $childrenMap, $pdo);

        // ボーナス取得
        $bonusStmt->execute([$userId]);
        $bonus = $bonusStmt->fetch();

        fputcsv($output, [
            $userId,
            $user['name'],
            $user['email'],
            $user['wallet_address'] ?? '',
            $user['rank'],
            (float)$user['investment_amount'],
            (int)$user['direct_referral_count'],
            $groupInvestment,
            $bonus ? (float)$bonus['unilevel_bonus']  : 0,
            $bonus ? (float)$bonus['infinity_bonus']  : 0,
            $bonus ? (float)$bonus['megamatch_bonus'] : 0,
            $bonus ? (float)$bonus['pool_bonus']      : 0,
            $bonus ? (float)$bonus['total_bonus']     : 0,
            $user['created_at'],
        ]);
    }

    fclose($output);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
