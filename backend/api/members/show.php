<?php
// backend/api/members/show.php  (GET: メンバー詳細 / PUT: 運用額更新)
// GET: 管理者または本人
// PUT: 管理者のみ
// URLパラメータ: ?id=xxx

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

// 認証（まず本人チェックのためrequireAdminはセットしない）
require_once __DIR__ . '/../../config/auth_check.php';

$targetId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($targetId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'id パラメータが必要です']);
    exit();
}

// ---------------------------------------------------------------
// GET: メンバー詳細（管理者または本人）
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($currentUser['role'] !== 'admin' && (int)$currentUser['id'] !== $targetId) {
        http_response_code(403);
        echo json_encode(['error' => '権限がありません']);
        exit();
    }

    try {
        $pdo = getDB();

        $stmt = $pdo->prepare(
            'SELECT u.id, u.name, u.email, u.role, u.rank,
                    u.investment_amount, u.referrer_id,
                    r.id   AS referrer_id2,
                    r.name AS referrer_name,
                    r.email AS referrer_email,
                    r.rank  AS referrer_rank
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

        // 直紹介一覧
        $stmt2 = $pdo->prepare(
            'SELECT id, name, email, rank, investment_amount
             FROM users WHERE referrer_id = ?'
        );
        $stmt2->execute([$targetId]);
        $directReferrals = $stmt2->fetchAll();

        // ボーナススナップショット（最新1件）
        $stmt3 = $pdo->prepare(
            'SELECT unilevel_bonus, infinity_bonus, megamatch_bonus, pool_bonus,
                    total_bonus, calculated_at
             FROM bonus_snapshots
             WHERE user_id = ?
             ORDER BY calculated_at DESC
             LIMIT 1'
        );
        $stmt3->execute([$targetId]);
        $bonusSnapshot = $stmt3->fetch() ?: null;

        $response = [
            'id'               => (int)$user['id'],
            'name'             => $user['name'],
            'email'            => $user['email'],
            'role'             => $user['role'],
            'rank'             => $user['rank'],
            'investment_amount'=> (float)$user['investment_amount'],
            'referrer'         => $user['referrer_id'] !== null ? [
                'id'    => (int)$user['referrer_id2'],
                'name'  => $user['referrer_name'],
                'email' => $user['referrer_email'],
                'rank'  => $user['referrer_rank'],
            ] : null,
            'direct_referrals' => array_map(function ($r) {
                return [
                    'id'               => (int)$r['id'],
                    'name'             => $r['name'],
                    'email'            => $r['email'],
                    'rank'             => $r['rank'],
                    'investment_amount'=> (float)$r['investment_amount'],
                ];
            }, $directReferrals),
            'bonus_snapshot'   => $bonusSnapshot ? [
                'unilevel_bonus'  => (float)$bonusSnapshot['unilevel_bonus'],
                'infinity_bonus'  => (float)$bonusSnapshot['infinity_bonus'],
                'megamatch_bonus' => (float)$bonusSnapshot['megamatch_bonus'],
                'pool_bonus'      => (float)$bonusSnapshot['pool_bonus'],
                'total_bonus'     => (float)$bonusSnapshot['total_bonus'],
                'calculated_at'   => $bonusSnapshot['calculated_at'],
            ] : null,
        ];

        echo json_encode($response);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// ---------------------------------------------------------------
// PUT: 運用額更新（管理者のみ）
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    if ($currentUser['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => '管理者権限が必要です']);
        exit();
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['investment_amount'])) {
        http_response_code(400);
        echo json_encode(['error' => 'investment_amount は必須です']);
        exit();
    }

    $investmentAmount = (float)$input['investment_amount'];
    if ($investmentAmount < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'investment_amount は0以上の値を指定してください']);
        exit();
    }

    try {
        $pdo = getDB();

        // 対象ユーザー存在確認
        $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$targetId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'ユーザーが見つかりません']);
            exit();
        }

        // 運用額を更新
        $stmt = $pdo->prepare('UPDATE users SET investment_amount = ? WHERE id = ?');
        $stmt->execute([$investmentAmount, $targetId]);

        // ランク再計算
        recalcUserRank($pdo, $targetId);

        // ボーナス再計算トリガー（全員）
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

        // 更新後のユーザーを返す
        $stmt = $pdo->prepare(
            'SELECT id, name, email, role, rank, investment_amount, referrer_id
             FROM users WHERE id = ?'
        );
        $stmt->execute([$targetId]);
        $updated = $stmt->fetch();

        echo json_encode([
            'id'               => (int)$updated['id'],
            'name'             => $updated['name'],
            'email'            => $updated['email'],
            'role'             => $updated['role'],
            'rank'             => $updated['rank'],
            'investment_amount'=> (float)$updated['investment_amount'],
            'referrer_id'      => $updated['referrer_id'] !== null ? (int)$updated['referrer_id'] : null,
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);

// ---------------------------------------------------------------
// ランク再計算ヘルパー（ランク条件をチェックして更新）
// ---------------------------------------------------------------
function recalcUserRank(PDO $pdo, int $userId): void
{
    // ユーザー情報取得
    $stmt = $pdo->prepare('SELECT investment_amount FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user) return;

    // 直紹介数
    $stmt = $pdo->prepare('SELECT COUNT(*) AS cnt FROM users WHERE referrer_id = ?');
    $stmt->execute([$userId]);
    $directCount = (int)$stmt->fetch()['cnt'];

    // グループ運用額（再帰）
    $stmt = $pdo->query('SELECT id, referrer_id FROM users');
    $allUsers = $stmt->fetchAll();
    $childrenMap = [];
    foreach ($allUsers as $u) {
        if ($u['referrer_id'] !== null) {
            $childrenMap[(int)$u['referrer_id']][] = (int)$u['id'];
        }
    }
    $groupInvestment = calcGroupInvestmentForRank($userId, $childrenMap, $pdo);

    // ランク条件取得（上位から判定）
    $stmt = $pdo->query(
        'SELECT rank, min_investment, min_direct_referrals, min_group_investment
         FROM rank_conditions
         ORDER BY min_investment DESC'
    );
    $conditions = $stmt->fetchAll();

    $newRank = 'none';
    foreach ($conditions as $cond) {
        if (
            (float)$user['investment_amount'] >= (float)$cond['min_investment'] &&
            $directCount >= (int)$cond['min_direct_referrals'] &&
            $groupInvestment >= (float)$cond['min_group_investment']
        ) {
            $newRank = $cond['rank'];
            break;
        }
    }

    $stmt = $pdo->prepare('UPDATE users SET rank = ? WHERE id = ?');
    $stmt->execute([$newRank, $userId]);
}

function calcGroupInvestmentForRank(int $userId, array $childrenMap, PDO $pdo): float
{
    $stmt = $pdo->prepare('SELECT investment_amount FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    $sum = (float)($row['investment_amount'] ?? 0);

    if (!empty($childrenMap[$userId])) {
        foreach ($childrenMap[$userId] as $childId) {
            $sum += calcGroupInvestmentForRank($childId, $childrenMap, $pdo);
        }
    }
    return $sum;
}
