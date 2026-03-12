<?php
// backend/api/fees/index.php  (GET: 手数料テーブル取得 / PUT: 手数料テーブル更新)
// GET: 認証済みユーザー全員
// PUT: 管理者のみ

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/auth_check.php';

// ---------------------------------------------------------------
// GET: 手数料テーブル一覧を取得
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo = getDB();

        $stmt = $pdo->query(
            'SELECT id, min_amount, max_amount, company_fee_rate, affiliate_fee_rate
             FROM fee_table
             ORDER BY min_amount ASC'
        );
        $rows = $stmt->fetchAll();

        // 数値型に変換
        $rows = array_map(function ($row) {
            return [
                'id'                 => (int)$row['id'],
                'min_amount'         => (float)$row['min_amount'],
                'max_amount'         => $row['max_amount'] !== null ? (float)$row['max_amount'] : null,
                'company_fee_rate'   => (float)$row['company_fee_rate'],
                'affiliate_fee_rate' => (float)$row['affiliate_fee_rate'],
            ];
        }, $rows);

        echo json_encode($rows);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// ---------------------------------------------------------------
// PUT: 手数料テーブルを全件入れ替え（管理者のみ）
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    // 管理者チェック
    if (!in_array($currentUser['role'], ['root', 'admin'])) {
        http_response_code(403);
        echo json_encode(['error' => '管理者権限が必要です']);
        exit();
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input) || count($input) === 0) {
        http_response_code(400);
        echo json_encode(['error' => '手数料データを配列で指定してください']);
        exit();
    }

    // バリデーション
    foreach ($input as $i => $row) {
        if (!isset($row['min_amount']) || !isset($row['company_fee_rate']) || !isset($row['affiliate_fee_rate'])) {
            http_response_code(400);
            echo json_encode(['error' => "行 " . ($i + 1) . " に必須フィールドがありません"]);
            exit();
        }
        if ((float)$row['min_amount'] < 0 || (float)$row['company_fee_rate'] < 0 || (float)$row['affiliate_fee_rate'] < 0) {
            http_response_code(400);
            echo json_encode(['error' => "行 " . ($i + 1) . " に負の値があります"]);
            exit();
        }
    }

    try {
        $pdo = getDB();
        $pdo->beginTransaction();

        // 全件削除
        $pdo->exec('DELETE FROM fee_table');

        // 全件挿入
        $stmt = $pdo->prepare(
            'INSERT INTO fee_table (min_amount, max_amount, company_fee_rate, affiliate_fee_rate)
             VALUES (?, ?, ?, ?)'
        );
        foreach ($input as $row) {
            $maxAmount = isset($row['max_amount']) && $row['max_amount'] !== null && $row['max_amount'] !== ''
                ? (float)$row['max_amount']
                : null;
            $stmt->execute([
                (float)$row['min_amount'],
                $maxAmount,
                (float)$row['company_fee_rate'],
                (float)$row['affiliate_fee_rate'],
            ]);
        }

        $pdo->commit();
        echo json_encode(['message' => '手数料テーブルを更新しました']);

    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
