<?php
// backend/api/members/info.php  (GET: ユニレベル配当フロー付きメンバー情報)
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

// Helper: get max rank in a leg (recursive)
function getMaxRankInLegForInfo(int $rootId, array $childrenMap, array $userMap, array $rankOrder): string {
    $maxRank = $userMap[$rootId]['rank'] ?? 'none';
    $maxOrd = $rankOrder[$maxRank] ?? 0;
    $stack = [$rootId];
    $visited = [$rootId => true];
    while (!empty($stack)) {
        $cur = array_pop($stack);
        if (!empty($childrenMap[$cur])) {
            foreach ($childrenMap[$cur] as $childId) {
                if (isset($visited[$childId])) continue;
                $visited[$childId] = true;
                if (isset($userMap[$childId])) {
                    $r = $userMap[$childId]['rank'] ?? 'none';
                    $o = $rankOrder[$r] ?? 0;
                    if ($o > $maxOrd) { $maxOrd = $o; $maxRank = $r; }
                    $stack[] = $childId;
                }
            }
        }
    }
    return $maxRank;
}

try {
    $pdo = getDB();

    // ユニレベルレート取得（共通）
    $stmt = $pdo->query('SELECT level, rate FROM unilevel_rates ORDER BY level ASC');
    $unilevelRates = $stmt->fetchAll();

    // ---------------------------------------------------------------
    // モード1: id パラメータなし → 全メンバーリスト + unilevel_rates
    // ---------------------------------------------------------------
    if (!isset($_GET['id'])) {
        $stmt = $pdo->query(
            "SELECT id, name, email, rank, investment_amount
             FROM users
             WHERE role NOT IN ('root', 'pool')
             ORDER BY id ASC"
        );
        $members = $stmt->fetchAll();

        $memberList = array_map(function ($m) {
            return [
                'id'                => (int)$m['id'],
                'name'              => $m['name'],
                'email'             => $m['email'],
                'rank'              => $m['rank'],
                'investment_amount' => (float)$m['investment_amount'],
            ];
        }, $members);

        echo json_encode([
            'members'        => $memberList,
            'unilevel_rates' => array_map(function ($r) {
                return [
                    'level' => (int)$r['level'],
                    'rate'  => (float)$r['rate'],
                ];
            }, $unilevelRates),
        ]);
        exit();
    }

    // ---------------------------------------------------------------
    // モード2: id パラメータあり → 詳細情報
    // ---------------------------------------------------------------
    $targetId = (int)$_GET['id'];

    if ($targetId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'id パラメータが不正です']);
        exit();
    }

    // 対象メンバー取得（紹介者情報含む）
    $stmt = $pdo->prepare(
        'SELECT u.id, u.name, u.email, u.role, u.rank,
                u.investment_amount, u.wallet_address, u.referrer_id,
                r.id   AS referrer_id2,
                r.name AS referrer_name,
                r.email AS referrer_email,
                r.rank  AS referrer_rank,
                r.wallet_address AS referrer_wallet_address
         FROM users u
         LEFT JOIN users r ON r.id = u.referrer_id
         WHERE u.id = ?
         LIMIT 1'
    );
    $stmt->execute([$targetId]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'ユーザーが見つかりません']);
        exit();
    }

    $revenue = (float)$user['investment_amount'] * 0.05;

    // member 基本情報
    $member = [
        'id'                => (int)$user['id'],
        'name'              => $user['name'],
        'email'             => $user['email'],
        'rank'              => $user['rank'],
        'investment_amount' => (float)$user['investment_amount'],
        'wallet_address'    => $user['wallet_address'],
        'revenue'           => round($revenue, 2),
        'referrer'          => $user['referrer_id'] !== null ? [
            'id'             => (int)$user['referrer_id2'],
            'name'           => $user['referrer_name'],
            'email'          => $user['referrer_email'],
            'rank'           => $user['referrer_rank'],
            'wallet_address' => $user['referrer_wallet_address'],
        ] : null,
    ];

    // ---------------------------------------------------------------
    // unilevel_flow: 紹介者チェーンを上方向に辿り、各レベルの受取人を特定
    // ---------------------------------------------------------------
    // レートをレベル番号でインデックス化
    $rateByLevel = [];
    foreach ($unilevelRates as $r) {
        $rateByLevel[(int)$r['level']] = (float)$r['rate'];
    }

    // 紹介者チェーン用: 全ユーザーをID→情報のマップに（効率のため一括取得）
    $stmt = $pdo->query(
        'SELECT id, name, email, rank, wallet_address, referrer_id, investment_amount FROM users'
    );
    $allUsers = $stmt->fetchAll();
    $userMap = [];
    foreach ($allUsers as $u) {
        $userMap[(int)$u['id']] = $u;
    }

    $unilevelFlow = [];
    $currentId = $user['referrer_id'] !== null ? (int)$user['referrer_id'] : null;

    for ($level = 1; $level <= 4; $level++) {
        $rate = $rateByLevel[$level] ?? 0.0;
        $amount = round($revenue * ($rate / 100), 2);

        if ($currentId !== null && isset($userMap[$currentId])) {
            $recipient = $userMap[$currentId];
            $unilevelFlow[] = [
                'level'     => $level,
                'rate'      => $rate,
                'amount'    => $amount,
                'recipient' => [
                    'id'             => (int)$recipient['id'],
                    'name'           => $recipient['name'],
                    'email'          => $recipient['email'],
                    'rank'           => $recipient['rank'],
                    'wallet_address' => $recipient['wallet_address'],
                ],
            ];
            // 次のレベルへ: この紹介者のさらに上の紹介者
            $currentId = $recipient['referrer_id'] !== null ? (int)$recipient['referrer_id'] : null;
        } else {
            $unilevelFlow[] = [
                'level'     => $level,
                'rate'      => $rate,
                'amount'    => $amount,
                'recipient' => null,
            ];
            // チェーンが切れたので以降も null
            $currentId = null;
        }
    }

    // ---------------------------------------------------------------
    // bonus_received: ボーナススナップショット（最新1件）
    // ---------------------------------------------------------------
    $stmt = $pdo->prepare(
        'SELECT unilevel_bonus, infinity_bonus, megamatch_bonus, pool_bonus,
                total_bonus, calculated_at
         FROM bonus_snapshots
         WHERE user_id = ?
         ORDER BY calculated_at DESC
         LIMIT 1'
    );
    $stmt->execute([$targetId]);
    $bonusRow = $stmt->fetch();

    $bonusReceived = $bonusRow ? [
        'unilevel_bonus'  => (float)$bonusRow['unilevel_bonus'],
        'infinity_bonus'  => (float)$bonusRow['infinity_bonus'],
        'megamatch_bonus' => (float)$bonusRow['megamatch_bonus'],
        'pool_bonus'      => (float)$bonusRow['pool_bonus'],
        'total_bonus'     => (float)$bonusRow['total_bonus'],
        'calculated_at'   => $bonusRow['calculated_at'],
    ] : null;

    // ---------------------------------------------------------------
    // direct_referrals: この人を紹介者としているメンバー一覧
    // ---------------------------------------------------------------
    $stmt = $pdo->prepare(
        'SELECT id, name, email, rank, investment_amount, wallet_address
         FROM users
         WHERE referrer_id = ?
         ORDER BY id ASC'
    );
    $stmt->execute([$targetId]);
    $directRows = $stmt->fetchAll();

    $directReferrals = array_map(function ($r) {
        return [
            'id'                => (int)$r['id'],
            'name'              => $r['name'],
            'email'             => $r['email'],
            'rank'              => $r['rank'],
            'investment_amount' => (float)$r['investment_amount'],
            'wallet_address'    => $r['wallet_address'],
        ];
    }, $directRows);

    // ---------------------------------------------------------------
    // A. Fee table lookup for member's tier
    // ---------------------------------------------------------------
    $stmt = $pdo->query('SELECT min_amount, max_amount, company_fee_rate, affiliate_fee_rate FROM fee_table ORDER BY min_amount ASC');
    $feeTable = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $companyFeeRate = 18.0; // default
    $affiliateFeeRate = 5.0; // default
    $investmentAmt = (float)$user['investment_amount'];
    foreach ($feeTable as $ft) {
        $min = (float)$ft['min_amount'];
        $max = $ft['max_amount'] !== null ? (float)$ft['max_amount'] : PHP_FLOAT_MAX;
        if ($investmentAmt >= $min && $investmentAmt <= $max) {
            $companyFeeRate = (float)$ft['company_fee_rate'];
            $affiliateFeeRate = (float)$ft['affiliate_fee_rate'];
            break;
        }
    }
    $memberPct = round(100 - $companyFeeRate - $affiliateFeeRate, 2);
    $poolContribPct = round(max(0, $affiliateFeeRate - 5.0), 2);

    // ---------------------------------------------------------------
    // B. Infinity allocation (per-member)
    // ---------------------------------------------------------------
    // Build children map
    $childrenMap = [];
    foreach ($userMap as $uid => $u) {
        $refId = $u['referrer_id'] !== null ? (int)$u['referrer_id'] : null;
        if ($refId !== null) {
            $childrenMap[$refId][] = $uid;
        }
    }

    // Rank conditions (infinity + megamatch)
    $stmt = $pdo->query(
        'SELECT rank, infinity_rate, megamatch_same_rate, megamatch_upper_rate,
                mm_min_investment, mm_min_direct_referrals, mm_min_group_investment
         FROM rank_conditions'
    );
    $rankConditions = [];
    foreach ($stmt->fetchAll() as $rc) {
        $rankConditions[$rc['rank']] = [
            'infinity_rate'          => (float)$rc['infinity_rate'],
            'megamatch_same_rate'    => (float)$rc['megamatch_same_rate'],
            'megamatch_upper_rate'   => (float)$rc['megamatch_upper_rate'],
            'mm_min_investment'      => (float)$rc['mm_min_investment'],
            'mm_min_direct_referrals'=> (int)$rc['mm_min_direct_referrals'],
            'mm_min_group_investment'=> (float)$rc['mm_min_group_investment'],
        ];
    }
    $rankOrder = ['none' => 0, 'bronze' => 1, 'silver' => 2, 'gold' => 3, 'platinum' => 4, 'diamond' => 5];

    // Compute infinity flow from this member
    $infinityFlow = [];
    $path = [$targetId];
    $tempId = $user['referrer_id'] !== null ? (int)$user['referrer_id'] : null;
    while ($tempId !== null && isset($userMap[$tempId])) {
        $path[] = $tempId;
        $tempId = $userMap[$tempId]['referrer_id'] !== null ? (int)$userMap[$tempId]['referrer_id'] : null;
    }

    for ($i = 1; $i < count($path); $i++) {
        $ancestorId = $path[$i];
        $ancestor = $userMap[$ancestorId];
        $ancestorRank = $ancestor['rank'] ?? 'none';
        if ($ancestorRank === 'none' || !isset($rankConditions[$ancestorRank])) continue;

        $ancestorInfRate = $rankConditions[$ancestorRank]['infinity_rate'];
        if ($ancestorInfRate <= 0) continue;

        // Leg root = ancestor's direct child in path to target
        $legRootId = $path[$i - 1];
        $legMaxRank = getMaxRankInLegForInfo($legRootId, $childrenMap, $userMap, $rankOrder);
        $legMaxRate = ($legMaxRank !== 'none' && isset($rankConditions[$legMaxRank]))
            ? $rankConditions[$legMaxRank]['infinity_rate'] : 0.0;

        $diffRate = $ancestorInfRate - $legMaxRate;
        if ($diffRate > 0) {
            $infinityFlow[] = [
                'rate' => round($diffRate, 2),
                'recipient' => [
                    'id' => (int)$ancestor['id'],
                    'name' => $ancestor['name'],
                    'email' => $ancestor['email'],
                    'rank' => $ancestorRank,
                    'wallet_address' => $ancestor['wallet_address'],
                ],
            ];
        }
    }

    // ---------------------------------------------------------------
    // B2. Megamatch flow (who does this member receive megamatch FROM?)
    // ---------------------------------------------------------------
    $megamatchFlow = [];
    $targetRank = $user['rank'] ?? 'none';
    $targetRankOrder = $rankOrder[$targetRank] ?? 0;

    if ($targetRank !== 'none' && isset($rankConditions[$targetRank])) {
        // Helper: get all descendants
        $getDescendantsForInfo = function(int $uid, array $cmap) use (&$getDescendantsForInfo): array {
            $result = [];
            foreach ($cmap[$uid] ?? [] as $cid) {
                $result[] = $cid;
                $result = array_merge($result, $getDescendantsForInfo($cid, $cmap));
            }
            return $result;
        };

        // Check if THIS member qualifies for megamatch
        $rc = $rankConditions[$targetRank];
        $myInvest = (float)$user['investment_amount'];
        $myDirectCount = count($childrenMap[$targetId] ?? []);
        $myDescendants = $getDescendantsForInfo($targetId, $childrenMap);
        $myGroupInvest = 0;
        foreach ($myDescendants as $did) {
            $myGroupInvest += (float)($userMap[$did]['investment_amount'] ?? 0);
        }

        $mmQualified = ($myInvest >= $rc['mm_min_investment'])
            && ($myDirectCount >= $rc['mm_min_direct_referrals'])
            && ($myGroupInvest >= $rc['mm_min_group_investment']);

        if ($mmQualified) {
            // Find ranked subordinates this member takes megamatch from
            foreach ($myDescendants as $descId) {
                if (!isset($userMap[$descId])) continue;
                $descRank = $userMap[$descId]['rank'] ?? 'none';
                if ($descRank === 'none') continue;
                $descRankOrder = $rankOrder[$descRank] ?? 0;

                if ($descRankOrder === $targetRankOrder) {
                    $mmRate = $rc['megamatch_same_rate'];
                    $mmType = 'same';
                } elseif ($descRankOrder > $targetRankOrder) {
                    $mmRate = $rc['megamatch_upper_rate'];
                    $mmType = 'upper';
                } else {
                    continue; // lower rank subordinates: no megamatch
                }
                if ($mmRate <= 0) continue;

                $desc = $userMap[$descId];
                $megamatchFlow[] = [
                    'rate' => round($mmRate, 2),
                    'type' => $mmType,
                    'direction' => 'incoming',
                    'source' => [
                        'id' => (int)$desc['id'],
                        'name' => $desc['name'],
                        'email' => $desc['email'],
                        'rank' => $descRank,
                        'wallet_address' => $desc['wallet_address'],
                    ],
                ];
            }
        }
    }

    // ---------------------------------------------------------------
    // B3. Megamatch outgoing (who takes megamatch FROM this member?)
    // ---------------------------------------------------------------
    if ($targetRank !== 'none') {
        if (!isset($getDescendantsForInfo)) {
            $getDescendantsForInfo = function(int $uid, array $cmap) use (&$getDescendantsForInfo): array {
                $result = [];
                foreach ($cmap[$uid] ?? [] as $cid) {
                    $result[] = $cid;
                    $result = array_merge($result, $getDescendantsForInfo($cid, $cmap));
                }
                return $result;
            };
        }

        // Walk up ancestors to find MM-qualified uplines who take from this member
        foreach ($path as $idx => $ancestorId) {
            if ($idx === 0) continue; // skip self
            if (!isset($userMap[$ancestorId])) continue;
            $anc = $userMap[$ancestorId];
            $ancRank = $anc['rank'] ?? 'none';
            if ($ancRank === 'none' || !isset($rankConditions[$ancRank])) continue;
            $ancRankOrder = $rankOrder[$ancRank] ?? 0;

            // Megamatch: ancestor takes from same or higher rank subordinates
            if ($ancRankOrder > $targetRankOrder) continue;

            // Check if ancestor qualifies for megamatch
            $arcRc = $rankConditions[$ancRank];
            $ancInvest = (float)($userMap[$ancestorId]['investment_amount'] ?? 0);
            if ($ancInvest < $arcRc['mm_min_investment']) continue;
            $ancDirectCount = count($childrenMap[$ancestorId] ?? []);
            if ($ancDirectCount < $arcRc['mm_min_direct_referrals']) continue;
            $ancDesc = $getDescendantsForInfo($ancestorId, $childrenMap);
            $ancGroupInvest = 0;
            foreach ($ancDesc as $did) {
                $ancGroupInvest += (float)($userMap[$did]['investment_amount'] ?? 0);
            }
            if ($ancGroupInvest < $arcRc['mm_min_group_investment']) continue;

            // Determine rate
            if ($ancRankOrder === $targetRankOrder) {
                $mmRate = $arcRc['megamatch_same_rate'];
                $mmType = 'same';
            } else {
                $mmRate = $arcRc['megamatch_upper_rate'];
                $mmType = 'upper';
            }
            if ($mmRate <= 0) continue;

            $megamatchFlow[] = [
                'rate' => round($mmRate, 2),
                'type' => $mmType,
                'direction' => 'outgoing',
                'source' => [
                    'id' => (int)$anc['id'],
                    'name' => $anc['name'],
                    'email' => $anc['email'],
                    'rank' => $ancRank,
                    'wallet_address' => $anc['wallet_address'],
                ],
            ];
        }
    }

    // ---------------------------------------------------------------
    // C. Company wallets
    // ---------------------------------------------------------------
    $companyWallets = [];
    try {
        $stmt = $pdo->query("SELECT label, wallet_address, percentage, wallet_type FROM company_wallets ORDER BY sort_order ASC");
        $companyWallets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        // table may not exist yet
    }

    $feeWallets = [];
    $poolWallet = null;
    foreach ($companyWallets as $cw) {
        if ($cw['wallet_type'] === 'pool') {
            $poolWallet = ['label' => $cw['label'], 'wallet_address' => $cw['wallet_address']];
        } else {
            $feeWallets[] = [
                'label' => $cw['label'],
                'wallet_address' => $cw['wallet_address'],
                'share_pct' => (float)$cw['percentage'], // share of company_fee
                'actual_pct' => round((float)$cw['percentage'] / 100 * $companyFeeRate, 2), // actual % of revenue
            ];
        }
    }

    // ---------------------------------------------------------------
    // D. Build transfer_allocation
    // ---------------------------------------------------------------
    // Unilevel total (only levels with recipients)
    $unilevelTotal = 0;
    $unilevelItems = [];
    foreach ($unilevelFlow as $uf) {
        $unilevelItems[] = [
            'label' => 'ユニレベル Lv.' . $uf['level'],
            'pct' => $uf['rate'],
            'wallet_address' => $uf['recipient'] ? $uf['recipient']['wallet_address'] : null,
            'recipient_name' => $uf['recipient'] ? $uf['recipient']['name'] : null,
        ];
        if ($uf['recipient']) $unilevelTotal += $uf['rate'];
    }

    $infinityTotal = 0;
    $infinityItems = [];
    foreach ($infinityFlow as $inf) {
        $infinityItems[] = [
            'label' => 'インフィニティ（' . $inf['recipient']['name'] . '）',
            'pct' => $inf['rate'],
            'wallet_address' => $inf['recipient']['wallet_address'],
            'recipient_name' => $inf['recipient']['name'],
            'recipient_rank' => $inf['recipient']['rank'],
        ];
        $infinityTotal += $inf['rate'];
    }

    $megamatchTotal = 0;
    $megamatchItems = [];
    foreach ($megamatchFlow as $mm) {
        $typeLabel = $mm['type'] === 'same' ? '同ランク' : '上位ランク';
        $dir = $mm['direction'] ?? 'incoming';
        if ($dir === 'incoming') {
            $label = $mm['source']['name'] . ' から受取（' . $typeLabel . '）';
        } else {
            $label = $mm['source']['name'] . ' へ控除（' . $typeLabel . '）';
        }
        $megamatchItems[] = [
            'label' => $label,
            'pct' => $mm['rate'],
            'wallet_address' => $mm['source']['wallet_address'],
            'recipient_name' => $mm['source']['name'],
            'recipient_rank' => $mm['source']['rank'],
            'type' => $mm['type'],
            'direction' => $dir,
        ];
        $megamatchTotal += $mm['rate'];
    }

    // 会社手数料: ウォレット未登録でもcompany_fee_rate分は必ず計上
    $companyTotal = 0;
    foreach ($feeWallets as $fw) {
        $companyTotal += $fw['actual_pct'];
    }
    if (empty($feeWallets) && $companyFeeRate > 0) {
        // ウォレット未登録 → 会社手数料全体を1行で表示
        $feeWallets[] = [
            'label' => '会社手数料',
            'wallet_address' => '',
            'share_pct' => 100.0,
            'actual_pct' => $companyFeeRate,
        ];
        $companyTotal = $companyFeeRate;
    }

    $allocatedTotal = round($memberPct + $unilevelTotal + $infinityTotal + $megamatchTotal + $poolContribPct + $companyTotal, 2);
    $unallocatedPct = round(100 - $allocatedTotal, 2);

    $transferAllocation = [
        'fee_tier' => [
            'company_fee_rate' => $companyFeeRate,
            'affiliate_fee_rate' => $affiliateFeeRate,
        ],
        'member' => [
            'pct' => $memberPct,
            'wallet_address' => $user['wallet_address'],
        ],
        'unilevel' => $unilevelItems,
        'unilevel_total_pct' => round($unilevelTotal, 2),
        'infinity' => $infinityItems,
        'infinity_total_pct' => round($infinityTotal, 2),
        'megamatch' => $megamatchItems,
        'megamatch_total_pct' => round($megamatchTotal, 2),
        'pool_contribution' => [
            'pct' => $poolContribPct,
            'wallet_address' => $poolWallet ? $poolWallet['wallet_address'] : null,
            'label' => $poolWallet ? $poolWallet['label'] : 'プール',
        ],
        'company' => $feeWallets,
        'company_total_pct' => round($companyTotal, 2),
        'unallocated_pct' => $unallocatedPct,
        'total_pct' => round($allocatedTotal + $unallocatedPct, 2),
    ];

    // ---------------------------------------------------------------
    // レスポンス
    // ---------------------------------------------------------------
    echo json_encode([
        'member'           => $member,
        'unilevel_flow'    => $unilevelFlow,
        'unilevel_rates'   => array_map(function ($r) {
            return [
                'level' => (int)$r['level'],
                'rate'  => (float)$r['rate'],
            ];
        }, $unilevelRates),
        'bonus_received'   => $bonusReceived,
        'direct_referrals' => $directReferrals,
        'transfer_allocation' => $transferAllocation,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'サーバーエラーが発生しました']);
}
