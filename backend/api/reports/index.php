<?php
// backend/api/reports/index.php  (GET: 指定月の全メンバーレポート / POST: レポート確定)
// 管理者のみ

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

$requireAdmin = true;
require_once __DIR__ . '/../../config/auth_check.php';

// ---------------------------------------------------------------
// GET: 指定月の全メンバーレポート
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $yearMonth = $_GET['year_month'] ?? date('Y-m');

    // バリデーション: YYYY-MM形式
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $yearMonth)) {
        http_response_code(400);
        echo json_encode(['error' => 'year_month は YYYY-MM 形式で指定してください']);
        exit();
    }

    try {
        $pdo = getDB();

        $stmt = $pdo->prepare(
            'SELECT mr.user_id, u.name, u.rank,
                    mr.unilevel_bonus, mr.infinity_bonus, mr.megamatch_bonus,
                    mr.pool_bonus, mr.total_bonus, mr.pool_contribution, mr.net_bonus
             FROM monthly_reports mr
             JOIN users u ON u.id = mr.user_id
             WHERE mr.`year_month` = ?
             ORDER BY mr.user_id ASC'
        );
        $stmt->execute([$yearMonth]);
        $rows = $stmt->fetchAll();

        $members = [];
        $summary = [
            'total_unilevel'  => 0.0,
            'total_infinity'  => 0.0,
            'total_megamatch' => 0.0,
            'total_pool'      => 0.0,
            'total_bonus'     => 0.0,
            'total_pool_contribution' => 0.0,
            'total_net'       => 0.0,
        ];

        foreach ($rows as $row) {
            $member = [
                'user_id'           => (int)$row['user_id'],
                'name'              => $row['name'],
                'rank'              => $row['rank'],
                'unilevel_bonus'    => (float)$row['unilevel_bonus'],
                'infinity_bonus'    => (float)$row['infinity_bonus'],
                'megamatch_bonus'   => (float)$row['megamatch_bonus'],
                'pool_bonus'        => (float)$row['pool_bonus'],
                'total_bonus'       => (float)$row['total_bonus'],
                'pool_contribution' => (float)$row['pool_contribution'],
                'net_bonus'         => (float)$row['net_bonus'],
            ];
            $members[] = $member;

            $summary['total_unilevel']  += $member['unilevel_bonus'];
            $summary['total_infinity']  += $member['infinity_bonus'];
            $summary['total_megamatch'] += $member['megamatch_bonus'];
            $summary['total_pool']      += $member['pool_bonus'];
            $summary['total_bonus']     += $member['total_bonus'];
            $summary['total_pool_contribution'] += $member['pool_contribution'];
            $summary['total_net']       += $member['net_bonus'];
        }

        echo json_encode([
            'year_month' => $yearMonth,
            'members'    => $members,
            'summary'    => $summary,
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// ---------------------------------------------------------------
// POST: 指定月のレポートを確定（bonus_snapshots → monthly_reports）
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $yearMonth = $input['year_month'] ?? date('Y-m');

    // バリデーション: YYYY-MM形式
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $yearMonth)) {
        http_response_code(400);
        echo json_encode(['error' => 'year_month は YYYY-MM 形式で指定してください']);
        exit();
    }

    try {
        $pdo = getDB();

        // bonus_snapshots から現在のデータを取得
        $stmt = $pdo->query(
            'SELECT bs.user_id, bs.unilevel_bonus, bs.infinity_bonus,
                    bs.megamatch_bonus, bs.pool_bonus, bs.total_bonus,
                    u.rank
             FROM bonus_snapshots bs
             JOIN users u ON u.id = bs.user_id
             ORDER BY bs.user_id ASC'
        );
        $snapshots = $stmt->fetchAll();

        if (empty($snapshots)) {
            http_response_code(400);
            echo json_encode(['error' => 'ボーナスデータが存在しません']);
            exit();
        }

        // rank_conditions を取得（pool_contribution_rate を計算に使用）
        $rcStmt = $pdo->query(
            'SELECT rank, pool_contribution_rate FROM rank_conditions'
        );
        $rcRows = $rcStmt->fetchAll();
        $contributionRates = [];
        foreach ($rcRows as $rc) {
            $contributionRates[$rc['rank']] = (float)$rc['pool_contribution_rate'];
        }

        $pdo->beginTransaction();

        $replaceStmt = $pdo->prepare(
            'REPLACE INTO monthly_reports
                (user_id, `year_month`, unilevel_bonus, infinity_bonus,
                 megamatch_bonus, pool_bonus, total_bonus,
                 pool_contribution, net_bonus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        $count = 0;
        foreach ($snapshots as $snap) {
            $userId         = (int)$snap['user_id'];
            $unilevel       = (float)$snap['unilevel_bonus'];
            $infinity       = (float)$snap['infinity_bonus'];
            $megamatch      = (float)$snap['megamatch_bonus'];
            $poolBonus      = (float)$snap['pool_bonus'];
            $totalBonus     = (float)$snap['total_bonus'];
            $rank           = $snap['rank'];

            // プール拠出額 = (unilevel + infinity + megamatch) * pool_contribution_rate / 100
            // ※pool_bonus自体は拠出対象外（calculate.phpと一致）
            $contributionRate = $contributionRates[$rank] ?? 0.0;
            $bonusBase = $unilevel + $infinity + $megamatch;
            $poolContribution = round($bonusBase * $contributionRate / 100, 2);
            $netBonus         = round($totalBonus - $poolContribution, 2);

            $replaceStmt->execute([
                $userId, $yearMonth,
                $unilevel, $infinity, $megamatch, $poolBonus,
                $totalBonus, $poolContribution, $netBonus,
            ]);
            $count++;
        }

        $pdo->commit();

        echo json_encode([
            'message'    => "レポートを確定しました（{$count}件）",
            'year_month' => $yearMonth,
            'count'      => $count,
        ]);

    } catch (PDOException $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
