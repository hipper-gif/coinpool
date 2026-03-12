<?php
// backend/api/bonus/calculate.php  (POST: ボーナス再計算)
// 内部API - ログイン不要だが外部からの不正呼び出し対策として
// 同一サーバーからの呼び出しのみ受け付ける（REMOTE_ADDR チェック）

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit();
}

// 内部呼び出しのみ許可
$remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
$allowedIps = ['127.0.0.1', '::1', $_SERVER['SERVER_ADDR'] ?? ''];
if (!in_array($remoteIp, $allowedIps, true)) {
    // セッション認証がある場合は管理者も許可
    if (!isset($_SESSION['user_id'])) {
        http_response_code(403);
        echo json_encode(['error' => 'アクセスが拒否されました']);
        exit();
    }
}

$input      = json_decode(file_get_contents('php://input'), true);
$targetUserId = isset($input['user_id']) && $input['user_id'] !== null
              ? (int)$input['user_id'] : null;

try {
    $pdo = getDB();

    // ---------------------------------------------------------------
    // マスターデータを一括取得
    // ---------------------------------------------------------------

    // 全ユーザー
    $stmt = $pdo->query(
        'SELECT id, name, referrer_id, investment_amount, rank
         FROM users ORDER BY id ASC'
    );
    $allUsers = $stmt->fetchAll();

    // ユーザーをidキーのマップに変換
    $usersById = [];
    foreach ($allUsers as $u) {
        $usersById[(int)$u['id']] = [
            'id'                => (int)$u['id'],
            'name'              => $u['name'],
            'referrer_id'       => $u['referrer_id'] !== null ? (int)$u['referrer_id'] : null,
            'investment_amount' => (float)$u['investment_amount'],
            'rank'              => $u['rank'],
        ];
    }

    // 親→子マップ
    $childrenMap = [];
    foreach ($usersById as $uid => $u) {
        if ($u['referrer_id'] !== null) {
            $childrenMap[$u['referrer_id']][] = $uid;
        }
    }

    // ランク条件（ランクをキーに）
    $stmt = $pdo->query(
        'SELECT rank, infinity_rate, megamatch_same_rate, megamatch_upper_rate,
                pool_distribution_rate, pool_contribution_rate
         FROM rank_conditions'
    );
    $rankConditions = [];
    foreach ($stmt->fetchAll() as $rc) {
        $rankConditions[$rc['rank']] = [
            'infinity_rate'          => (float)$rc['infinity_rate'],
            'megamatch_same_rate'    => (float)$rc['megamatch_same_rate'],
            'megamatch_upper_rate'   => (float)$rc['megamatch_upper_rate'],
            'pool_distribution_rate' => (float)$rc['pool_distribution_rate'],
            'pool_contribution_rate' => (float)$rc['pool_contribution_rate'],
        ];
    }

    // ユニレベル率（レベルをキーに）
    $stmt = $pdo->query('SELECT level, rate FROM unilevel_rates ORDER BY level ASC');
    $unilevelRates = [];
    foreach ($stmt->fetchAll() as $ur) {
        $unilevelRates[(int)$ur['level']] = (float)$ur['rate'];
    }

    // プール残高
    $stmt       = $pdo->query('SELECT id, balance FROM pool_balance ORDER BY id ASC LIMIT 1');
    $poolRecord = $stmt->fetch();
    $poolBalance = $poolRecord ? (float)$poolRecord['balance'] : 0.0;
    $poolRecordId = $poolRecord ? (int)$poolRecord['id'] : null;

    // 基準収益率 5%
    $BASE_YIELD_RATE = 0.05;

    // ---------------------------------------------------------------
    // 計算対象ユーザーを決定
    // ---------------------------------------------------------------
    $targetIds = ($targetUserId !== null)
        ? [$targetUserId]
        : array_keys($usersById);

    // ---------------------------------------------------------------
    // ボーナス蓄積配列を初期化
    // ---------------------------------------------------------------
    $bonuses = [];
    foreach ($targetIds as $uid) {
        $bonuses[$uid] = [
            'unilevel_bonus'  => 0.0,
            'infinity_bonus'  => 0.0,
            'megamatch_bonus' => 0.0,
            'pool_bonus'      => 0.0,
        ];
    }

    // ---------------------------------------------------------------
    // ヘルパー関数群
    // ---------------------------------------------------------------

    /**
     * 再帰的に傘下全員のIDを取得する
     */
    function getDescendants(int $userId, array $childrenMap): array
    {
        $result = [];
        if (!empty($childrenMap[$userId])) {
            foreach ($childrenMap[$userId] as $childId) {
                $result[] = $childId;
                $result   = array_merge($result, getDescendants($childId, $childrenMap));
            }
        }
        return $result;
    }

    /**
     * 傘下の最高ランクの infinity_rate を再帰的に求める
     * ランクの強さ順: none < bronze < silver < gold < platinum < diamond
     */
    function getMaxDescendantInfinityRate(int $userId, array $childrenMap, array $usersById, array $rankConditions): float
    {
        $rankOrder = ['none' => 0, 'bronze' => 1, 'silver' => 2, 'gold' => 3, 'platinum' => 4, 'diamond' => 5];
        $maxRate   = 0.0;
        $maxOrder  = 0;

        if (empty($childrenMap[$userId])) return 0.0;

        foreach ($childrenMap[$userId] as $childId) {
            if (!isset($usersById[$childId])) continue;
            $childRank  = $usersById[$childId]['rank'];
            $childOrder = $rankOrder[$childRank] ?? 0;
            if ($childRank !== 'none' && $childOrder > $maxOrder) {
                $maxOrder = $childOrder;
                $maxRate  = $rankConditions[$childRank]['infinity_rate'] ?? 0.0;
            }
            // 再帰
            $descendantRate = getMaxDescendantInfinityRate($childId, $childrenMap, $usersById, $rankConditions);
            // descendantRateに対応するorderを取得（再帰内で最大のrateを持つランクを探す）
            foreach ($rankConditions as $rname => $rdata) {
                if (abs($rdata['infinity_rate'] - $descendantRate) < 0.0001) {
                    $rOrder = $rankOrder[$rname] ?? 0;
                    if ($rOrder > $maxOrder) {
                        $maxOrder = $rOrder;
                        $maxRate  = $descendantRate;
                    }
                }
            }
        }
        return $maxRate;
    }

    /**
     * 傘下の最高ランクを返す
     */
    function getMaxDescendantRank(int $userId, array $childrenMap, array $usersById): string
    {
        $rankOrder = ['none' => 0, 'bronze' => 1, 'silver' => 2, 'gold' => 3, 'platinum' => 4, 'diamond' => 5];
        $maxRank   = 'none';
        $maxOrder  = 0;

        if (empty($childrenMap[$userId])) return 'none';

        foreach ($childrenMap[$userId] as $childId) {
            if (!isset($usersById[$childId])) continue;
            $childRank  = $usersById[$childId]['rank'];
            $childOrder = $rankOrder[$childRank] ?? 0;
            if ($childOrder > $maxOrder) {
                $maxOrder = $childOrder;
                $maxRank  = $childRank;
            }
            $descRank  = getMaxDescendantRank($childId, $childrenMap, $usersById);
            $descOrder = $rankOrder[$descRank] ?? 0;
            if ($descOrder > $maxOrder) {
                $maxOrder = $descOrder;
                $maxRank  = $descRank;
            }
        }
        return $maxRank;
    }

    // ---------------------------------------------------------------
    // 1. ユニレベルボーナス計算
    // ---------------------------------------------------------------
    // 対象ユーザーの investment_amount × unilevel_rates[level].rate / 100
    // を上位4段の紹介者に加算する
    foreach ($targetIds as $uid) {
        if (!isset($usersById[$uid])) continue;
        $investAmt = $usersById[$uid]['investment_amount'];
        if ($investAmt <= 0) continue;

        $currentId = $uid;
        for ($level = 1; $level <= 4; $level++) {
            $parentId = $usersById[$currentId]['referrer_id'] ?? null;
            if ($parentId === null) break;

            $rate = $unilevelRates[$level] ?? 0.0;
            $unilevelBonus = $investAmt * ($rate / 100);

            // 上位ユーザーが計算対象に含まれていれば加算
            if (isset($bonuses[$parentId])) {
                $bonuses[$parentId]['unilevel_bonus'] += $unilevelBonus;
            } elseif ($targetUserId === null) {
                // 全員計算モードで未初期化の場合（対象外のユーザー）はスキップ
            }

            $currentId = $parentId;
            if (!isset($usersById[$currentId])) break;
        }
    }

    // ---------------------------------------------------------------
    // 2. インフィニティボーナス計算（差額還元方式）
    // ---------------------------------------------------------------
    // 組織全体の発生収益 = 全ユーザーの investment_amount 合計 × BASE_YIELD_RATE
    $totalInvestment    = array_sum(array_column($usersById, 'investment_amount'));
    $orgTotalRevenue    = $totalInvestment * $BASE_YIELD_RATE;

    foreach ($targetIds as $uid) {
        if (!isset($usersById[$uid])) continue;
        $userRank = $usersById[$uid]['rank'];
        if ($userRank === 'none') continue;

        $myInfinityRate  = $rankConditions[$userRank]['infinity_rate'] ?? 0.0;
        $maxDescRate     = getMaxDescendantInfinityRate($uid, $childrenMap, $usersById, $rankConditions);
        $diffRate        = $myInfinityRate - $maxDescRate;

        if ($diffRate > 0) {
            $bonuses[$uid]['infinity_bonus'] += $orgTotalRevenue * ($diffRate / 100);
        }
    }

    // ---------------------------------------------------------------
    // 3. メガマッチタイトルボーナス計算
    // ---------------------------------------------------------------
    // 事前にユニレベル+インフィニティの合計を計算
    $subTotals = [];
    foreach ($targetIds as $uid) {
        $subTotals[$uid] = $bonuses[$uid]['unilevel_bonus'] + $bonuses[$uid]['infinity_bonus'];
    }

    $rankOrder = ['none' => 0, 'bronze' => 1, 'silver' => 2, 'gold' => 3, 'platinum' => 4, 'diamond' => 5];

    foreach ($targetIds as $uid) {
        if (!isset($usersById[$uid])) continue;
        $userRank  = $usersById[$uid]['rank'];
        if ($userRank === 'none') continue;
        $userOrder = $rankOrder[$userRank];

        // 傘下の全メンバーをチェック
        $descendants = getDescendants($uid, $childrenMap);
        foreach ($descendants as $descId) {
            if (!isset($usersById[$descId])) continue;
            $descRank  = $usersById[$descId]['rank'];
            if ($descRank === 'none') continue;
            $descOrder = $rankOrder[$descRank];

            // 傘下の報酬合計
            $descSubTotal = $subTotals[$descId] ?? 0.0;
            if ($descSubTotal <= 0) continue;

            $megamatchBonus = 0.0;

            if ($descOrder === $userOrder) {
                // 同ランク
                $rate = $rankConditions[$userRank]['megamatch_same_rate'] ?? 0.0;
                $megamatchBonus = $descSubTotal * ($rate / 100);
            } elseif ($descOrder > $userOrder) {
                // 上位ランク（傘下に上位ランクがいる場合）
                $rate = $rankConditions[$userRank]['megamatch_upper_rate'] ?? 0.0;
                $megamatchBonus = $descSubTotal * ($rate / 100);
            }

            if (isset($bonuses[$uid])) {
                $bonuses[$uid]['megamatch_bonus'] += $megamatchBonus;
            }
        }
    }

    // ---------------------------------------------------------------
    // 4. プールボーナス計算
    // ---------------------------------------------------------------
    // プール有資格者（noneでないユーザー）を特定
    $poolEligibleIds = [];
    foreach ($targetIds as $uid) {
        if (!isset($usersById[$uid])) continue;
        if ($usersById[$uid]['rank'] !== 'none') {
            $poolEligibleIds[] = $uid;
        }
    }

    if (!empty($poolEligibleIds) && $poolBalance > 0) {
        $eligibleCount = count($poolEligibleIds);

        foreach ($poolEligibleIds as $uid) {
            $userRank = $usersById[$uid]['rank'];
            $distRate = $rankConditions[$userRank]['pool_distribution_rate'] ?? 0.0;
            // 均等分配: pool_balance × distribution_rate / 100 / 有資格者数
            $bonuses[$uid]['pool_bonus'] += ($poolBalance * ($distRate / 100)) / $eligibleCount;
        }
    }

    // プールへの拠出計算（ボーナス合計の contribution_rate% を積み上げ）
    $poolContribution = 0.0;
    foreach ($poolEligibleIds as $uid) {
        $userRank    = $usersById[$uid]['rank'];
        $contribRate = $rankConditions[$userRank]['pool_contribution_rate'] ?? 0.0;
        $totalSoFar  = $bonuses[$uid]['unilevel_bonus']
                     + $bonuses[$uid]['infinity_bonus']
                     + $bonuses[$uid]['megamatch_bonus'];
        $poolContribution += $totalSoFar * ($contribRate / 100);
    }

    // プール残高を更新（分配後に拠出を加算）
    if ($poolRecordId !== null && $poolContribution > 0) {
        $stmt = $pdo->prepare('UPDATE pool_balance SET balance = balance + ? WHERE id = ?');
        $stmt->execute([$poolContribution, $poolRecordId]);
    }

    // ---------------------------------------------------------------
    // 5. bonus_snapshots に upsert
    // ---------------------------------------------------------------
    $stmt = $pdo->prepare(
        'INSERT INTO bonus_snapshots
            (user_id, unilevel_bonus, infinity_bonus, megamatch_bonus, pool_bonus, total_bonus, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            unilevel_bonus  = VALUES(unilevel_bonus),
            infinity_bonus  = VALUES(infinity_bonus),
            megamatch_bonus = VALUES(megamatch_bonus),
            pool_bonus      = VALUES(pool_bonus),
            total_bonus     = VALUES(total_bonus),
            calculated_at   = VALUES(calculated_at)'
    );

    // NOTE: bonus_snapshots には user_id に UNIQUE KEY がないため
    // 既存レコードがあれば DELETE + INSERT で代替する方式を使う
    $upsertStmt = $pdo->prepare(
        'SELECT id FROM bonus_snapshots WHERE user_id = ? ORDER BY calculated_at DESC LIMIT 1'
    );
    $updateStmt = $pdo->prepare(
        'UPDATE bonus_snapshots SET
            unilevel_bonus  = ?,
            infinity_bonus  = ?,
            megamatch_bonus = ?,
            pool_bonus      = ?,
            total_bonus     = ?,
            calculated_at   = NOW()
         WHERE user_id = ?
         ORDER BY calculated_at DESC
         LIMIT 1'
    );
    $insertStmt = $pdo->prepare(
        'INSERT INTO bonus_snapshots
            (user_id, unilevel_bonus, infinity_bonus, megamatch_bonus, pool_bonus, total_bonus, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())'
    );

    foreach ($bonuses as $uid => $b) {
        $total = $b['unilevel_bonus'] + $b['infinity_bonus'] + $b['megamatch_bonus'] + $b['pool_bonus'];

        $upsertStmt->execute([$uid]);
        $existing = $upsertStmt->fetch();

        if ($existing) {
            $updateStmt->execute([
                round($b['unilevel_bonus'],  2),
                round($b['infinity_bonus'],  2),
                round($b['megamatch_bonus'], 2),
                round($b['pool_bonus'],      2),
                round($total,                2),
                $uid,
            ]);
        } else {
            $insertStmt->execute([
                $uid,
                round($b['unilevel_bonus'],  2),
                round($b['infinity_bonus'],  2),
                round($b['megamatch_bonus'], 2),
                round($b['pool_bonus'],      2),
                round($total,                2),
            ]);
        }
    }

    echo json_encode([
        'message'       => 'ボーナス計算が完了しました',
        'calculated'    => count($bonuses),
        'pool_contribution_added' => round($poolContribution, 2),
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました: ' . $e->getMessage()]);
}
