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

// 内部呼び出しまたは管理者のみ許可
$remoteIp = $_SERVER['REMOTE_ADDR'] ?? '';
$allowedIps = ['127.0.0.1', '::1', $_SERVER['SERVER_ADDR'] ?? ''];
if (!in_array($remoteIp, $allowedIps, true)) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(403);
        echo json_encode(['error' => 'アクセスが拒否されました']);
        exit();
    }
}

$input        = json_decode(file_get_contents('php://input'), true);
$targetUserId = isset($input['user_id']) && $input['user_id'] !== null
              ? (int)$input['user_id'] : null;

/**
 * グループ投資額を再帰計算（ランク判定用）
 */
function calcGroupInvestment(int $userId, array $childrenMap, array $usersById): float
{
    $sum = 0.0;
    if (!empty($childrenMap[$userId])) {
        foreach ($childrenMap[$userId] as $childId) {
            if (!isset($usersById[$childId])) continue;
            $sum += $usersById[$childId]['investment_amount'];
            $sum += calcGroupInvestment($childId, $childrenMap, $usersById);
        }
    }
    return $sum;
}

try {
    $pdo = getDB();
    $pdo->beginTransaction();

    // ---------------------------------------------------------------
    // マスターデータを一括取得
    // ---------------------------------------------------------------

    // 全ユーザー
    $stmt = $pdo->query(
        'SELECT id, name, referrer_id, investment_amount, rank
         FROM users ORDER BY id ASC'
    );
    $allUsers = $stmt->fetchAll();

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

    // 親→子マップ（ランク再計算にも使用）
    $childrenMap = [];
    foreach ($usersById as $uid => $u) {
        if ($u['referrer_id'] !== null) {
            $childrenMap[$u['referrer_id']][] = $uid;
        }
    }

    // ---------------------------------------------------------------
    // ランク一括再計算（ボーナス計算前に全員のランクを最新化）
    // ---------------------------------------------------------------
    $rankCondStmt = $pdo->query(
        'SELECT rank, min_investment, min_direct_referrals, min_group_investment
         FROM rank_conditions ORDER BY min_investment DESC'
    );
    $rankCondForCalc = $rankCondStmt->fetchAll();

    $rankUpdateStmt = $pdo->prepare('UPDATE users SET rank = ? WHERE id = ?');
    $rankChanges = [];

    foreach ($usersById as $uid => $user) {
        $directCount = count($childrenMap[$uid] ?? []);
        $groupInvestment = calcGroupInvestment($uid, $childrenMap, $usersById);

        $newRank = 'none';
        foreach ($rankCondForCalc as $cond) {
            if (
                $user['investment_amount'] >= (float)$cond['min_investment'] &&
                $directCount >= (int)$cond['min_direct_referrals'] &&
                $groupInvestment >= (float)$cond['min_group_investment']
            ) {
                $newRank = $cond['rank'];
                break;
            }
        }

        if ($newRank !== $user['rank']) {
            $rankUpdateStmt->execute([$newRank, $uid]);
            $rankChanges[] = ['id' => $uid, 'name' => $user['name'], 'from' => $user['rank'], 'to' => $newRank];
            $usersById[$uid]['rank'] = $newRank;
        }
    }

    // ランク条件（ランクをキーに）— ボーナス率等を含む完全版
    $stmt = $pdo->query(
        'SELECT rank, min_investment, min_direct_referrals, min_group_investment,
                mm_min_investment, mm_min_direct_referrals, mm_min_group_investment,
                infinity_rate, megamatch_same_rate, megamatch_upper_rate,
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
            'mm_min_investment'       => (float)$rc['mm_min_investment'],
            'mm_min_direct_referrals' => (int)$rc['mm_min_direct_referrals'],
            'mm_min_group_investment' => (float)$rc['mm_min_group_investment'],
        ];
    }

    // ユニレベル率（レベルをキーに）
    $stmt = $pdo->query('SELECT level, rate FROM unilevel_rates ORDER BY level ASC');
    $unilevelRates = [];
    foreach ($stmt->fetchAll() as $ur) {
        $unilevelRates[(int)$ur['level']] = (float)$ur['rate'];
    }

    // 手数料テーブル（プール原資計算用）
    $stmt = $pdo->query('SELECT min_amount, max_amount, affiliate_fee_rate FROM fee_table ORDER BY min_amount ASC');
    $feeTable = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // プール残高（FOR UPDATE でロック）
    $stmt       = $pdo->query('SELECT id, balance FROM pool_balance ORDER BY id ASC LIMIT 1 FOR UPDATE');
    $poolRecord = $stmt->fetch();
    $poolBalance  = $poolRecord ? (float)$poolRecord['balance'] : 0.0;
    $poolRecordId = $poolRecord ? (int)$poolRecord['id'] : null;

    // ボーナスキャップ率（system_settings テーブルから取得）
    // 0 または未設定の場合はキャップ無効
    $bonusCapRate = 0.0;
    try {
        $capStmt = $pdo->query(
            "SELECT setting_value FROM system_settings WHERE setting_key = 'bonus_cap_rate' LIMIT 1"
        );
        $capRow = $capStmt->fetch();
        if ($capRow && (float)$capRow['setting_value'] > 0) {
            $bonusCapRate = (float)$capRow['setting_value'];
        }
    } catch (PDOException $e) {
        // テーブル未作成の場合は無視（キャップ無効のまま）
        $bonusCapRate = 0.0;
    }

    // 基準収益率 5%
    $BASE_YIELD_RATE = 0.05;

    // ---------------------------------------------------------------
    // 計算対象ユーザーを決定
    // ---------------------------------------------------------------
    $targetIds = ($targetUserId !== null)
        ? [$targetUserId]
        : array_keys($usersById);

    // ---------------------------------------------------------------
    // ボーナス蓄積配列を初期化（全ユーザー分。メガマッチ控除のため）
    // ---------------------------------------------------------------
    $bonuses = [];
    // 各メンバーの投資額から発生して他者に渡る報酬の合計（キャップチェック用）
    $outflows = [];
    foreach (array_keys($usersById) as $uid) {
        $bonuses[$uid] = [
            'unilevel_bonus'  => 0.0,
            'infinity_bonus'  => 0.0,
            'megamatch_bonus' => 0.0,
            'pool_bonus'      => 0.0,
        ];
        $outflows[$uid] = 0.0;
    }

    // ---------------------------------------------------------------
    // ヘルパー関数群
    // ---------------------------------------------------------------
    $rankOrder = ['none' => 0, 'bronze' => 1, 'silver' => 2, 'gold' => 3, 'platinum' => 4, 'diamond' => 5];

    /**
     * 再帰的に傘下全員のIDを取得する（循環検出付き）
     */
    function getDescendants(int $userId, array $childrenMap, array &$visited = []): array
    {
        $result = [];
        if (!empty($childrenMap[$userId])) {
            foreach ($childrenMap[$userId] as $childId) {
                if (isset($visited[$childId])) continue; // 循環防止
                $visited[$childId] = true;
                $result[] = $childId;
                $result = array_merge($result, getDescendants($childId, $childrenMap, $visited));
            }
        }
        return $result;
    }

    /**
     * 特定legの最高ランクを返す（直下の子ツリー内）
     */
    function getMaxRankInLeg(int $rootId, array $childrenMap, array $usersById, array $rankOrder): string
    {
        $maxRank  = $usersById[$rootId]['rank'] ?? 'none';
        $maxOrder = $rankOrder[$maxRank] ?? 0;
        $visited = [$rootId => true];
        $descendants = getDescendants($rootId, $childrenMap, $visited);
        foreach ($descendants as $did) {
            if (!isset($usersById[$did])) continue;
            $r = $usersById[$did]['rank'] ?? 'none';
            $o = $rankOrder[$r] ?? 0;
            if ($o > $maxOrder) {
                $maxOrder = $o;
                $maxRank  = $r;
            }
        }
        return $maxRank;
    }

    /**
     * 特定legの投資額合計を返す
     */
    function getLegInvestment(int $rootId, array $childrenMap, array $usersById): float
    {
        $total = $usersById[$rootId]['investment_amount'] ?? 0;
        $visited = [$rootId => true];
        $descendants = getDescendants($rootId, $childrenMap, $visited);
        foreach ($descendants as $did) {
            $total += $usersById[$did]['investment_amount'] ?? 0;
        }
        return $total;
    }

    /**
     * 手数料テーブルからアフィリエイト報酬率を取得
     */
    function getAffiliateFeeRate(float $investment, array $feeTable): float
    {
        foreach ($feeTable as $row) {
            $min = (float)$row['min_amount'];
            $max = $row['max_amount'] !== null ? (float)$row['max_amount'] : PHP_FLOAT_MAX;
            if ($investment >= $min && $investment <= $max) {
                return (float)$row['affiliate_fee_rate'];
            }
        }
        return 5.0; // デフォルト最低ライン
    }

    /**
     * メガマッチ資格チェック（インフィニティとは別条件）
     */
    function isMegaMatchQualified(int $userId, array $usersById, array $childrenMap, array $rankConditions): bool
    {
        $user = $usersById[$userId];
        $rank = $user['rank'];
        if ($rank === 'none' || !isset($rankConditions[$rank])) return false;

        $rc = $rankConditions[$rank];

        // 本人運用額チェック
        if ($user['investment_amount'] < $rc['mm_min_investment']) return false;

        // 直紹介数チェック
        $directCount = count($childrenMap[$userId] ?? []);
        if ($directCount < $rc['mm_min_direct_referrals']) return false;

        // グループ運用額チェック
        $visited = [$userId => true];
        $descendants = getDescendants($userId, $childrenMap, $visited);
        $groupInvestment = 0;
        foreach ($descendants as $did) {
            $groupInvestment += $usersById[$did]['investment_amount'] ?? 0;
        }
        if ($groupInvestment < $rc['mm_min_group_investment']) return false;

        return true;
    }

    // ---------------------------------------------------------------
    // 1. ユニレベルボーナス計算
    // ---------------------------------------------------------------
    foreach (array_keys($usersById) as $uid) {
        $investAmt = $usersById[$uid]['investment_amount'];
        if ($investAmt <= 0) continue;

        $currentId = $uid;
        for ($level = 1; $level <= 4; $level++) {
            $parentId = $usersById[$currentId]['referrer_id'] ?? null;
            if ($parentId === null || !isset($usersById[$parentId])) break;

            $rate = $unilevelRates[$level] ?? 0.0;
            $revenue = $investAmt * $BASE_YIELD_RATE; // 報酬額（投資額×利回り）
            $unilevelBonus = $revenue * ($rate / 100);
            $bonuses[$parentId]['unilevel_bonus'] += $unilevelBonus;

            // 流出額トラッカー: $uid の投資額から発生した報酬
            $outflows[$uid] += $unilevelBonus;

            $currentId = $parentId;
        }
    }

    // ---------------------------------------------------------------
    // 2. インフィニティボーナス計算（差額還元方式・系列別）
    // ---------------------------------------------------------------
    foreach (array_keys($usersById) as $uid) {
        $userRank = $usersById[$uid]['rank'];
        if ($userRank === 'none') continue;

        $myInfinityRate = $rankConditions[$userRank]['infinity_rate'] ?? 0.0;
        $directChildren = $childrenMap[$uid] ?? [];

        foreach ($directChildren as $childId) {
            if (!isset($usersById[$childId])) continue;

            // この系列（leg）内の最高ランクを取得
            $legMaxRank = getMaxRankInLeg($childId, $childrenMap, $usersById, $rankOrder);
            $legMaxRate = ($legMaxRank !== 'none' && isset($rankConditions[$legMaxRank]))
                ? $rankConditions[$legMaxRank]['infinity_rate']
                : 0.0;

            $diffRate = $myInfinityRate - $legMaxRate;
            if ($diffRate <= 0) continue; // 同ランク以上がいる系列は0

            // この系列の収益
            $legInvestment = getLegInvestment($childId, $childrenMap, $usersById);
            $legRevenue    = $legInvestment * $BASE_YIELD_RATE;

            $infinityAmount = $legRevenue * ($diffRate / 100);
            $bonuses[$uid]['infinity_bonus'] += $infinityAmount;

            // 流出額トラッカー: レグ内の各メンバーの投資額に按分
            if ($legInvestment > 0 && $infinityAmount > 0) {
                $visited2 = [$childId => true];
                $legMembers = array_merge([$childId], getDescendants($childId, $childrenMap, $visited2));
                foreach ($legMembers as $legMemberId) {
                    if (!isset($usersById[$legMemberId])) continue;
                    $memberInvest = $usersById[$legMemberId]['investment_amount'] ?? 0;
                    if ($memberInvest > 0) {
                        $outflows[$legMemberId] += $infinityAmount * ($memberInvest / $legInvestment);
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------
    // 3. メガマッチタイトルボーナス計算
    // ---------------------------------------------------------------
    // 事前にユニレベル+インフィニティの合計を全員分計算
    $subTotals = [];
    foreach (array_keys($usersById) as $uid) {
        $subTotals[$uid] = $bonuses[$uid]['unilevel_bonus'] + $bonuses[$uid]['infinity_bonus'];
    }

    foreach (array_keys($usersById) as $uid) {
        $userRank = $usersById[$uid]['rank'];
        if ($userRank === 'none') continue;

        // メガマッチ専用資格チェック
        if (!isMegaMatchQualified($uid, $usersById, $childrenMap, $rankConditions)) continue;

        $userOrder = $rankOrder[$userRank];

        // 傘下の全メンバーをチェック
        $visited = [$uid => true];
        $descendants = getDescendants($uid, $childrenMap, $visited);
        foreach ($descendants as $descId) {
            if (!isset($usersById[$descId])) continue;
            $descRank = $usersById[$descId]['rank'];
            if ($descRank === 'none') continue;
            $descOrder = $rankOrder[$descRank];

            $descSubTotal = $subTotals[$descId] ?? 0.0;
            if ($descSubTotal <= 0) continue;

            $megamatchBonus = 0.0;

            if ($descOrder === $userOrder) {
                // 同ランク：同ランクの傘下メンバーの報酬からsame_rate%を受取る
                $rate = $rankConditions[$userRank]['megamatch_same_rate'] ?? 0.0;
                $megamatchBonus = $descSubTotal * ($rate / 100);
            } elseif ($descOrder < $userOrder) {
                // 下位ランク：自分より下のランクの傘下メンバーの報酬からupper_rate%を受取る
                $rate = $rankConditions[$userRank]['megamatch_upper_rate'] ?? 0.0;
                $megamatchBonus = $descSubTotal * ($rate / 100);
            }
            // descOrder > userOrder（傘下に自分より上位ランクがいる場合）は対象外

            if ($megamatchBonus > 0) {
                $bonuses[$uid]['megamatch_bonus'] += $megamatchBonus;

                // 対象メンバーの報酬から控除（PDF仕様: 原資は対象者の報酬）
                if ($descSubTotal > 0) {
                    $uniRatio = $bonuses[$descId]['unilevel_bonus'] / $descSubTotal;
                    $infRatio = $bonuses[$descId]['infinity_bonus'] / $descSubTotal;
                    $bonuses[$descId]['unilevel_bonus']  -= $megamatchBonus * $uniRatio;
                    $bonuses[$descId]['infinity_bonus']  -= $megamatchBonus * $infRatio;
                }
            }
        }
    }

    // メガマッチ控除で負になった場合は0にクランプ
    foreach ($bonuses as $uid => &$b) {
        $b['unilevel_bonus']  = max(0, $b['unilevel_bonus']);
        $b['infinity_bonus']  = max(0, $b['infinity_bonus']);
    }
    unset($b);

    // ---------------------------------------------------------------
    // 4. プールボーナス計算（30%分配 / 70%繰越）
    // ---------------------------------------------------------------

    // 4a. プール分配（残高の30%をランク階層別に分配）
    $distributablePool = $poolBalance * 0.30;
    $totalDistributed  = 0.0;

    if ($distributablePool > 0 && $targetUserId === null) {
        // ランク別にユーザーをグループ化
        $usersByRank = [];
        foreach (array_keys($usersById) as $uid) {
            $r = $usersById[$uid]['rank'];
            if ($r === 'none') continue;
            $usersByRank[$r][] = $uid;
        }

        // 各ティアの分配定義（PDFの30%内訳: 2+3+5+7.5+12.5=30）
        $tiers = [
            'bronze'   => ['rate' => 2.0  / 30.0, 'eligible' => ['bronze','silver','gold','platinum','diamond']],
            'silver'   => ['rate' => 3.0  / 30.0, 'eligible' => ['silver','gold','platinum','diamond']],
            'gold'     => ['rate' => 5.0  / 30.0, 'eligible' => ['gold','platinum','diamond']],
            'platinum' => ['rate' => 7.5  / 30.0, 'eligible' => ['platinum','diamond']],
            'diamond'  => ['rate' => 12.5 / 30.0, 'eligible' => ['diamond']],
        ];

        foreach ($tiers as $tierRank => $tierDef) {
            $tierPool = $distributablePool * $tierDef['rate'];

            // このティアの有資格者を集める
            $eligibleForTier = [];
            foreach ($tierDef['eligible'] as $eligRank) {
                if (isset($usersByRank[$eligRank])) {
                    $eligibleForTier = array_merge($eligibleForTier, $usersByRank[$eligRank]);
                }
            }

            if (empty($eligibleForTier)) continue;

            $perPerson = $tierPool / count($eligibleForTier);
            foreach ($eligibleForTier as $uid) {
                $bonuses[$uid]['pool_bonus'] += $perPerson;
            }
            $totalDistributed += $tierPool;
        }
    }

    // 4b. プール拠出計算
    // (1) メンバー報酬からの拠出（unilevel + infinity + megamatch の contribution_rate%）
    $memberContribution = 0.0;
    foreach (array_keys($usersById) as $uid) {
        $userRank = $usersById[$uid]['rank'];
        if ($userRank === 'none') continue;
        $contribRate = $rankConditions[$userRank]['pool_contribution_rate'] ?? 0.0;
        $totalSoFar  = $bonuses[$uid]['unilevel_bonus']
                     + $bonuses[$uid]['infinity_bonus']
                     + $bonuses[$uid]['megamatch_bonus'];
        $memberContribution += $totalSoFar * ($contribRate / 100);
    }

    // (2) 余剰アフィリエイト報酬からの拠出（PRIMARY原資）
    $feeContribution = 0.0;
    $BASE_AFFILIATE_RATE = 5.0; // 5%がボーナス原資
    foreach ($usersById as $uid => $user) {
        if ($user['investment_amount'] <= 0) continue;
        $affiliateRate = getAffiliateFeeRate($user['investment_amount'], $feeTable);
        $excessRate = $affiliateRate - $BASE_AFFILIATE_RATE;
        if ($excessRate > 0) {
            $feeContribution += $user['investment_amount'] * ($excessRate / 100);
        }
    }

    $poolContribution = $memberContribution + $feeContribution;

    // 4c. プール残高更新（全員計算モードのみ）
    if ($poolRecordId !== null && $targetUserId === null) {
        // 新残高 = 旧残高 × 70%（30%は分配済み） + 今回の拠出
        $newPoolBalance = ($poolBalance * 0.70) + $poolContribution;
        $stmt = $pdo->prepare('UPDATE pool_balance SET balance = ? WHERE id = ?');
        $stmt->execute([round($newPoolBalance, 2), $poolRecordId]);
    }

    // ---------------------------------------------------------------
    // 4d. ボーナスキャップ超過チェック（警告のみ、縮小しない）
    // 各メンバーの投資額から発生して他者に渡る報酬の合計が
    // 投資額 × bonusCapRate% を超えていないかチェック
    // ---------------------------------------------------------------
    $capWarnings = [];
    if ($bonusCapRate > 0) {
        foreach (array_keys($usersById) as $uid) {
            $investAmt = $usersById[$uid]['investment_amount'];
            if ($investAmt <= 0) continue;

            $capLimit    = $investAmt * ($bonusCapRate / 100);
            $totalOutflow = $outflows[$uid] ?? 0.0;

            if ($totalOutflow > $capLimit && $totalOutflow > 0) {
                $capWarnings[] = [
                    'user_id'      => $uid,
                    'name'         => $usersById[$uid]['name'],
                    'investment'   => $investAmt,
                    'total_outflow'=> round($totalOutflow, 2),
                    'cap_limit'    => round($capLimit, 2),
                    'excess'       => round($totalOutflow - $capLimit, 2),
                ];
            }
        }
    }

    // ---------------------------------------------------------------
    // 5. bonus_snapshots に upsert
    // ---------------------------------------------------------------
    $upsertStmt = $pdo->prepare(
        'INSERT INTO bonus_snapshots
            (user_id, unilevel_bonus, infinity_bonus, megamatch_bonus, pool_bonus, total_bonus, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            unilevel_bonus  = VALUES(unilevel_bonus),
            infinity_bonus  = VALUES(infinity_bonus),
            megamatch_bonus = VALUES(megamatch_bonus),
            pool_bonus      = VALUES(pool_bonus),
            total_bonus     = VALUES(total_bonus),
            calculated_at   = NOW()'
    );

    $savedCount = 0;
    foreach ($targetIds as $uid) {
        if (!isset($bonuses[$uid])) continue;
        $b     = $bonuses[$uid];
        $total = $b['unilevel_bonus'] + $b['infinity_bonus'] + $b['megamatch_bonus'] + $b['pool_bonus'];

        $upsertStmt->execute([
            $uid,
            round($b['unilevel_bonus'],  2),
            round($b['infinity_bonus'],  2),
            round($b['megamatch_bonus'], 2),
            round($b['pool_bonus'],      2),
            round($total,                2),
        ]);
        $savedCount++;
    }

    $pdo->commit();

    echo json_encode([
        'message'              => 'ボーナス計算が完了しました',
        'calculated'           => $savedCount,
        'pool_distributed'     => round($totalDistributed, 2),
        'pool_member_contrib'  => round($memberContribution, 2),
        'pool_fee_contrib'     => round($feeContribution, 2),
        'bonus_cap_rate'       => $bonusCapRate,
        'cap_warnings'         => $capWarnings,
        'rank_changes'         => $rankChanges,
    ]);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました: ' . $e->getMessage()]);
}
