<?php
// backend/api/members/index.php  (GET: 全メンバー一覧 / POST: メンバー追加)
// 管理者のみ

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

$requireAdmin = true;
require_once __DIR__ . '/../../config/auth_check.php';

// ---------------------------------------------------------------
// ヘルパー: 傘下全員の investment_amount を再帰的に合計する
// ---------------------------------------------------------------
function calcGroupInvestment(int $userId, array $childrenMap): float
{
    $pdo  = getDB();
    $stmt = $pdo->prepare('SELECT investment_amount FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row  = $stmt->fetch();
    $sum  = (float)($row['investment_amount'] ?? 0);

    if (!empty($childrenMap[$userId])) {
        foreach ($childrenMap[$userId] as $childId) {
            $sum += calcGroupInvestment($childId, $childrenMap);
        }
    }
    return $sum;
}

// ---------------------------------------------------------------
// ヘルパー: 全ユーザーを取得して親→子マップを構築
// ---------------------------------------------------------------
function buildChildrenMap(PDO $pdo): array
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
// GET: 全メンバー一覧
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo = getDB();

        // 全ユーザー取得（直紹介数も集計）
        $stmt = $pdo->query(
            'SELECT u.id, u.name, u.email, u.role, u.rank,
                    u.investment_amount, u.referrer_id, u.wallet_address, u.created_at,
                    r.name AS referrer_name,
                    (SELECT COUNT(*) FROM users c WHERE c.referrer_id = u.id) AS direct_referral_count,
                    COALESCE(bs.total_bonus, 0) AS total_bonus
             FROM users u
             LEFT JOIN users r ON r.id = u.referrer_id
             LEFT JOIN bonus_snapshots bs ON bs.user_id = u.id
             WHERE u.role != \'root\'
             ORDER BY u.id ASC'
        );
        $users       = $stmt->fetchAll();
        $childrenMap = buildChildrenMap($pdo);

        $result = [];
        foreach ($users as $user) {
            $result[] = [
                'id'                   => (int)$user['id'],
                'name'                 => $user['name'],
                'email'                => $user['email'],
                'role'                 => $user['role'],
                'rank'                 => $user['rank'],
                'investment_amount'    => (float)$user['investment_amount'],
                'referrer_id'          => $user['referrer_id'] !== null ? (int)$user['referrer_id'] : null,
                'referrer_name'        => $user['referrer_name'],
                'wallet_address'       => $user['wallet_address'],
                'direct_referral_count'=> (int)$user['direct_referral_count'],
                'group_investment'     => calcGroupInvestment((int)$user['id'], $childrenMap),
                'total_bonus'          => (float)$user['total_bonus'],
                'created_at'           => $user['created_at'],
            ];
        }

        echo json_encode($result);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// ---------------------------------------------------------------
// POST: メンバー追加
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => '不正なリクエストです']);
        exit();
    }

    $name        = trim($input['name']        ?? '');
    $email       = trim($input['email']       ?? '');
    $password    = $input['password']          ?? '';
    $referrer_id = isset($input['referrer_id']) && $input['referrer_id'] !== '' && $input['referrer_id'] !== null
                    ? (int)$input['referrer_id'] : null;

    if ($name === '' || $email === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name, email, password は必須です']);
        exit();
    }

    try {
        $pdo = getDB();

        // メール重複チェック
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'このメールアドレスは既に登録されています']);
            exit();
        }

        // referrer_id 存在確認
        if ($referrer_id !== null) {
            $stmt = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([$referrer_id]);
            if (!$stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => '紹介者が見つかりません']);
                exit();
            }
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        if ($hash === false) {
            http_response_code(500);
            echo json_encode(['error' => 'パスワードの処理に失敗しました']);
            exit();
        }

        $stmt = $pdo->prepare(
            'INSERT INTO users (name, email, password, role, referrer_id, investment_amount, rank)
             VALUES (?, ?, ?, \'member\', ?, 0.00, \'none\')'
        );
        $stmt->execute([$name, $email, $hash, $referrer_id]);
        $newId = (int)$pdo->lastInsertId();

        // ボーナス再計算トリガー
        $calcUrl = 'http://' . $_SERVER['HTTP_HOST']
                 . rtrim(dirname($_SERVER['SCRIPT_NAME']), '/members')
                 . '/bonus/calculate.php';
        @file_get_contents($calcUrl, false, stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => 'Content-Type: application/json',
                'content' => json_encode(['user_id' => null]),
                'timeout' => 5,
            ],
        ]));

        // 作成したユーザーを返す
        $stmt = $pdo->prepare(
            'SELECT id, name, email, role, rank, investment_amount, referrer_id
             FROM users WHERE id = ?'
        );
        $stmt->execute([$newId]);
        $newUser = $stmt->fetch();

        http_response_code(201);
        echo json_encode([
            'id'               => (int)$newUser['id'],
            'name'             => $newUser['name'],
            'email'            => $newUser['email'],
            'role'             => $newUser['role'],
            'rank'             => $newUser['rank'],
            'investment_amount'=> (float)$newUser['investment_amount'],
            'referrer_id'      => $newUser['referrer_id'] !== null ? (int)$newUser['referrer_id'] : null,
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
