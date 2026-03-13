<?php
require_once(__DIR__ . '/../../config/cors.php');
require_once(__DIR__ . '/../../config/database.php');

session_start();

require_once(__DIR__ . '/../../config/auth_check.php');

$method = $_SERVER['REQUEST_METHOD'];

// GET: 自分の情報取得
if ($method === 'GET') {
    echo json_encode([
        'id'    => $currentUser['id'],
        'name'  => $currentUser['name'],
        'email' => $currentUser['email'],
        'role'  => $currentUser['role'],
    ]);
    exit();
}

// PUT: 自分の情報更新
if ($method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);

    $name            = isset($input['name']) ? trim($input['name']) : null;
    $email           = isset($input['email']) ? trim($input['email']) : null;
    $walletAddress   = array_key_exists('wallet_address', $input ?? []) ? $input['wallet_address'] : null;
    $currentPassword = isset($input['current_password']) ? $input['current_password'] : null;
    $newPassword     = isset($input['new_password']) ? $input['new_password'] : null;

    // 何も変更がない場合
    if ($name === null && $email === null && $walletAddress === null && $newPassword === null) {
        http_response_code(400);
        echo json_encode(['error' => '変更する項目がありません']);
        exit();
    }

    try {
        $pdo = getDB();

        // メール重複チェック（自分以外）
        if ($email !== null && $email !== $currentUser['email']) {
            if ($email === '') {
                http_response_code(400);
                echo json_encode(['error' => 'メールアドレスを入力してください']);
                exit();
            }
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1');
            $stmt->execute([$email, $currentUser['id']]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'このメールアドレスは既に使用されています']);
                exit();
            }
        }

        // パスワード変更のバリデーション
        if ($newPassword !== null) {
            if ($currentPassword === null || $currentPassword === '') {
                http_response_code(400);
                echo json_encode(['error' => '現在のパスワードを入力してください']);
                exit();
            }
            if (strlen($newPassword) < 6) {
                http_response_code(400);
                echo json_encode(['error' => '新しいパスワードは6文字以上で入力してください']);
                exit();
            }
            // 現在のパスワードを検証
            $stmt = $pdo->prepare('SELECT password FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([$currentUser['id']]);
            $row = $stmt->fetch();
            if (!$row || !password_verify($currentPassword, $row['password'])) {
                http_response_code(400);
                echo json_encode(['error' => '現在のパスワードが正しくありません']);
                exit();
            }
        }

        // UPDATE文の動的構築
        $sets = [];
        $params = [];

        if ($name !== null) {
            if ($name === '') {
                http_response_code(400);
                echo json_encode(['error' => '名前を入力してください']);
                exit();
            }
            $sets[] = 'name = ?';
            $params[] = $name;
        }

        if ($email !== null) {
            $sets[] = 'email = ?';
            $params[] = $email;
        }

        if ($walletAddress !== null) {
            $wa = trim($walletAddress);
            $sets[] = 'wallet_address = ?';
            $params[] = $wa !== '' ? $wa : null;
        }

        if ($newPassword !== null) {
            $sets[] = 'password = ?';
            $params[] = password_hash($newPassword, PASSWORD_DEFAULT);
        }

        if (count($sets) > 0) {
            $params[] = $currentUser['id'];
            $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }

        // 更新後のユーザー情報を取得
        $stmt = $pdo->prepare('SELECT id, name, email, role, wallet_address FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$currentUser['id']]);
        $updatedUser = $stmt->fetch();

        echo json_encode([
            'message' => 'プロフィールを更新しました',
            'user'    => [
                'id'             => $updatedUser['id'],
                'name'           => $updatedUser['name'],
                'email'          => $updatedUser['email'],
                'role'           => $updatedUser['role'],
                'wallet_address' => $updatedUser['wallet_address'],
            ],
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// その他のメソッド
http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
