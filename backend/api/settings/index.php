<?php
// backend/api/settings/index.php  (GET: 設定取得 / PUT: 設定更新)
// GET: 認証済みユーザー全員
// PUT: 管理者のみ

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

// PUT のみ管理者限定。GET はメンバーも参照可能なため、
// ここでは requireAdmin をセットせず個別に判定する。
require_once __DIR__ . '/../../config/auth_check.php';

// ---------------------------------------------------------------
// GET: ランク条件とユニレベル率を取得
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo = getDB();

        $stmt = $pdo->query(
            'SELECT rank, min_investment, min_direct_referrals, min_group_investment,
                    mm_min_investment, mm_min_direct_referrals, mm_min_group_investment,
                    infinity_rate, megamatch_same_rate, megamatch_upper_rate,
                    pool_distribution_rate, pool_contribution_rate
             FROM rank_conditions
             ORDER BY min_investment ASC'
        );
        $rankConditions = $stmt->fetchAll();

        $stmt2 = $pdo->query('SELECT level, rate FROM unilevel_rates ORDER BY level ASC');
        $unilevelRates = $stmt2->fetchAll();

        // 数値型に変換
        $rankConditions = array_map(function ($rc) {
            return [
                'rank'                    => $rc['rank'],
                'min_investment'          => (float)$rc['min_investment'],
                'min_direct_referrals'    => (int)$rc['min_direct_referrals'],
                'min_group_investment'    => (float)$rc['min_group_investment'],
                'mm_min_investment'       => (float)$rc['mm_min_investment'],
                'mm_min_direct_referrals' => (int)$rc['mm_min_direct_referrals'],
                'mm_min_group_investment' => (float)$rc['mm_min_group_investment'],
                'infinity_rate'           => (float)$rc['infinity_rate'],
                'megamatch_same_rate'     => (float)$rc['megamatch_same_rate'],
                'megamatch_upper_rate'    => (float)$rc['megamatch_upper_rate'],
                'pool_distribution_rate'  => (float)$rc['pool_distribution_rate'],
                'pool_contribution_rate'  => (float)$rc['pool_contribution_rate'],
            ];
        }, $rankConditions);

        $unilevelRates = array_map(function ($ur) {
            return [
                'level' => (int)$ur['level'],
                'rate'  => (float)$ur['rate'],
            ];
        }, $unilevelRates);

        echo json_encode([
            'rank_conditions' => $rankConditions,
            'unilevel_rates'  => $unilevelRates,
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// ---------------------------------------------------------------
// PUT: ランク条件またはユニレベル率を更新
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    // PUT は管理者のみ
    if (!in_array($currentUser['role'], ['root', 'admin'])) {
        http_response_code(403);
        echo json_encode(['error' => '管理者権限が必要です']);
        exit();
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['rank_conditions']) && !isset($input['unilevel_rates'])) {
        http_response_code(400);
        echo json_encode(['error' => 'rank_conditions または unilevel_rates を指定してください']);
        exit();
    }

    try {
        $pdo = getDB();
        $pdo->beginTransaction();

        // ランク条件の更新
        if (!empty($input['rank_conditions'])) {
            $stmt = $pdo->prepare(
                'UPDATE rank_conditions SET
                    min_investment         = ?,
                    min_direct_referrals   = ?,
                    min_group_investment   = ?,
                    mm_min_investment      = ?,
                    mm_min_direct_referrals = ?,
                    mm_min_group_investment = ?,
                    infinity_rate          = ?,
                    megamatch_same_rate    = ?,
                    megamatch_upper_rate   = ?,
                    pool_distribution_rate = ?,
                    pool_contribution_rate = ?
                 WHERE rank = ?'
            );
            foreach ($input['rank_conditions'] as $rc) {
                if (empty($rc['rank'])) continue;
                $stmt->execute([
                    (float)($rc['min_investment']          ?? 0),
                    (int)  ($rc['min_direct_referrals']    ?? 0),
                    (float)($rc['min_group_investment']    ?? 0),
                    (float)($rc['mm_min_investment']       ?? 0),
                    (int)  ($rc['mm_min_direct_referrals'] ?? 0),
                    (float)($rc['mm_min_group_investment'] ?? 0),
                    (float)($rc['infinity_rate']           ?? 0),
                    (float)($rc['megamatch_same_rate']     ?? 0),
                    (float)($rc['megamatch_upper_rate']    ?? 0),
                    (float)($rc['pool_distribution_rate']  ?? 0),
                    (float)($rc['pool_contribution_rate']  ?? 0),
                    $rc['rank'],
                ]);
            }
        }

        // ユニレベル率の更新
        if (!empty($input['unilevel_rates'])) {
            $stmt2 = $pdo->prepare(
                'INSERT INTO unilevel_rates (level, rate)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE rate = VALUES(rate)'
            );
            foreach ($input['unilevel_rates'] as $ur) {
                if (!isset($ur['level']) || !isset($ur['rate'])) continue;
                $stmt2->execute([(int)$ur['level'], (float)$ur['rate']]);
            }
        }

        $pdo->commit();

        // 全ユーザーのボーナス再計算トリガー
        $calcUrl = 'http://' . $_SERVER['HTTP_HOST']
                 . rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/')
                 . '/bonus/calculate.php';
        @file_get_contents($calcUrl, false, stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => 'Content-Type: application/json',
                'content' => json_encode(['user_id' => null]),
                'timeout' => 5,
            ],
        ]));

        echo json_encode(['message' => '設定を更新しました']);

    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
