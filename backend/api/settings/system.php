<?php
// backend/api/settings/system.php  (GET: システム設定取得 / PUT: システム設定更新)
// GET: 認証済みユーザー全員
// PUT: 管理者(root/admin)のみ

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/auth_check.php';

// ---------------------------------------------------------------
// GET: システム設定を key-value で返す
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo  = getDB();
        $stmt = $pdo->query('SELECT setting_key, setting_value FROM system_settings');
        $rows = $stmt->fetchAll();

        $settings = [];
        foreach ($rows as $row) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        echo json_encode($settings);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// ---------------------------------------------------------------
// PUT: システム設定を更新 (管理者のみ)
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    if (!in_array($currentUser['role'], ['root', 'admin'])) {
        http_response_code(403);
        echo json_encode(['error' => '管理者権限が必要です']);
        exit();
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'JSON形式で設定を送信してください']);
        exit();
    }

    try {
        $pdo = getDB();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare(
            'INSERT INTO system_settings (setting_key, setting_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        );

        foreach ($input as $key => $value) {
            $stmt->execute([(string)$key, (string)$value]);
        }

        $pdo->commit();
        echo json_encode(['message' => 'システム設定を更新しました']);

    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
