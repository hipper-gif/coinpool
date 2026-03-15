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
    if (!in_array($currentUser['role'], ['root', 'admin']) && (int)$currentUser['id'] !== $targetId) {
        http_response_code(403);
        echo json_encode(['error' => '権限がありません']);
        exit();
    }

    try {
        $pdo = getDB();

        $stmt = $pdo->prepare(
            'SELECT u.id, u.name, u.email, u.role, u.rank,
                    u.investment_amount, u.referrer_id, u.wallet_address,
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
            'wallet_address'   => $user['wallet_address'],
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
    if (!in_array($currentUser['role'], ['root', 'admin'])) {
        http_response_code(403);
        echo json_encode(['error' => '管理者権限が必要です']);
        exit();
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => '不正なリクエストです']);
        exit();
    }

    $isRoot = $currentUser['role'] === 'root';

    try {
        $pdo = getDB();

        // 対象ユーザー存在確認
        $stmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$targetId]);
        $targetUser = $stmt->fetch();
        if (!$targetUser) {
            http_response_code(404);
            echo json_encode(['error' => 'ユーザーが見つかりません']);
            exit();
        }

        $setClauses = [];
        $params     = [];

        // 運用額（admin/root共通）
        if (isset($input['investment_amount'])) {
            $investmentAmount = (float)$input['investment_amount'];
            if ($investmentAmount < 0) {
                http_response_code(400);
                echo json_encode(['error' => 'investment_amount は0以上の値を指定してください']);
                exit();
            }
            $setClauses[] = 'investment_amount = ?';
            $params[]     = $investmentAmount;
        }

        // 以下のフィールドはrootのみ編集可能
        if ($isRoot) {
            if (isset($input['name']) && trim($input['name']) !== '') {
                $setClauses[] = 'name = ?';
                $params[]     = trim($input['name']);
            }

            if (isset($input['email']) && trim($input['email']) !== '') {
                $newEmail = trim($input['email']);
                // メール重複チェック（自分以外）
                $chk = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
                $chk->execute([$newEmail, $targetId]);
                if ($chk->fetch()) {
                    http_response_code(409);
                    echo json_encode(['error' => 'このメールアドレスは既に使用されています']);
                    exit();
                }
                $setClauses[] = 'email = ?';
                $params[]     = $newEmail;
            }

            if (isset($input['role'])) {
                $validRoles = ['admin', 'member', 'pool'];
                if (!in_array($input['role'], $validRoles)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'role は admin または member を指定してください']);
                    exit();
                }
                $setClauses[] = 'role = ?';
                $params[]     = $input['role'];
            }

            if (isset($input['rank'])) {
                $validRanks = ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
                if (!in_array($input['rank'], $validRanks)) {
                    http_response_code(400);
                    echo json_encode(['error' => '不正なランクです']);
                    exit();
                }
                $setClauses[] = 'rank = ?';
                $params[]     = $input['rank'];
            }

            if (array_key_exists('wallet_address', $input)) {
                $wa = $input['wallet_address'] !== null ? trim($input['wallet_address']) : '';
                $setClauses[] = 'wallet_address = ?';
                $params[]     = $wa !== '' ? $wa : null;
            }

            if (array_key_exists('referrer_id', $input)) {
                if ($input['referrer_id'] === null || $input['referrer_id'] === '') {
                    $setClauses[] = 'referrer_id = NULL';
                } else {
                    $refId = (int)$input['referrer_id'];
                    if ($refId === $targetId) {
                        http_response_code(400);
                        echo json_encode(['error' => '自分自身を紹介者にすることはできません']);
                        exit();
                    }
                    $chk = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
                    $chk->execute([$refId]);
                    if (!$chk->fetch()) {
                        http_response_code(400);
                        echo json_encode(['error' => '紹介者が見つかりません']);
                        exit();
                    }
                    $setClauses[] = 'referrer_id = ?';
                    $params[]     = $refId;
                }
            }

            if (isset($input['password']) && $input['password'] !== '') {
                $hash = password_hash($input['password'], PASSWORD_DEFAULT);
                if ($hash === false) {
                    http_response_code(500);
                    echo json_encode(['error' => 'パスワードの処理に失敗しました']);
                    exit();
                }
                $setClauses[] = 'password = ?';
                $params[]     = $hash;
            }
        }

        if (empty($setClauses)) {
            http_response_code(400);
            echo json_encode(['error' => '更新するフィールドがありません']);
            exit();
        }

        $params[] = $targetId;
        $sql = 'UPDATE users SET ' . implode(', ', $setClauses) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        // ランク再計算（運用額変更時、またはrankを手動で変更していない場合）
        if (isset($input['investment_amount']) && !isset($input['rank'])) {
            recalcUserRank($pdo, $targetId);
        }

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
            'SELECT id, name, email, role, rank, investment_amount, referrer_id, wallet_address
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
            'wallet_address'   => $updated['wallet_address'],
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// ---------------------------------------------------------------
// DELETE: メンバー削除（管理者のみ）
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if (!in_array($currentUser['role'], ['root', 'admin'])) {
        http_response_code(403);
        echo json_encode(['error' => '管理者権限が必要です']);
        exit();
    }

    // 自分自身は削除不可
    if ((int)$currentUser['id'] === $targetId) {
        http_response_code(400);
        echo json_encode(['error' => '自分自身を削除することはできません']);
        exit();
    }

    try {
        $pdo = getDB();

        // 対象ユーザー存在確認
        $stmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$targetId]);
        $target = $stmt->fetch();
        if (!$target) {
            http_response_code(404);
            echo json_encode(['error' => 'ユーザーが見つかりません']);
            exit();
        }

        // rootユーザー・poolアカウントは削除不可
        if ($target['role'] === 'root' || $target['role'] === 'pool') {
            http_response_code(403);
            echo json_encode(['error' => 'このユーザーは削除できません']);
            exit();
        }

        // 削除実行（bonus_snapshots は CASCADE、referrer_id は SET NULL で自動処理）
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$targetId]);

        echo json_encode(['message' => 'メンバーを削除しました']);

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
