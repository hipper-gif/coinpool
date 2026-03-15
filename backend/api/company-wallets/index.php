<?php
// backend/api/company-wallets/index.php  (GET: 会社ウォレット取得 / PUT: 会社ウォレット全件入替)
// GET / PUT: 管理者のみ

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
$requireAdmin = true;
require_once __DIR__ . '/../../config/auth_check.php';

// ---------------------------------------------------------------
// GET: 会社ウォレット一覧を取得
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo = getDB();

        $stmt = $pdo->query(
            'SELECT id, label, wallet_address, percentage, wallet_type, sort_order
             FROM company_wallets
             ORDER BY sort_order ASC, id ASC'
        );
        $rows = $stmt->fetchAll();

        // 型変換
        $rows = array_map(function ($row) {
            return [
                'id'             => (int)$row['id'],
                'label'          => $row['label'],
                'wallet_address' => $row['wallet_address'],
                'percentage'     => (float)$row['percentage'],
                'wallet_type'    => $row['wallet_type'],
                'sort_order'     => (int)$row['sort_order'],
            ];
        }, $rows);

        echo json_encode(['wallets' => $rows]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

// ---------------------------------------------------------------
// PUT: 会社ウォレットを全件入れ替え（管理者のみ）
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input) || !isset($input['wallets']) || !is_array($input['wallets'])) {
        http_response_code(400);
        echo json_encode(['error' => 'wallets配列を指定してください']);
        exit();
    }

    $wallets = $input['wallets'];

    // バリデーション
    foreach ($wallets as $i => $row) {
        if (empty($row['label']) || empty($row['wallet_address'])) {
            http_response_code(400);
            echo json_encode(['error' => "行 " . ($i + 1) . " にlabelまたはwallet_addressがありません"]);
            exit();
        }
        if (!isset($row['percentage']) || (float)$row['percentage'] < 0) {
            http_response_code(400);
            echo json_encode(['error' => "行 " . ($i + 1) . " のpercentageが不正です"]);
            exit();
        }
        if (!isset($row['wallet_type']) || !in_array($row['wallet_type'], ['fee', 'pool'])) {
            http_response_code(400);
            echo json_encode(['error' => "行 " . ($i + 1) . " のwallet_typeはfeeまたはpoolを指定してください"]);
            exit();
        }
    }

    // feeタイプの配分比率が合計100%か検証
    $feeTotal = 0;
    $hasFee = false;
    foreach ($wallets as $row) {
        if ($row['wallet_type'] === 'fee') {
            $feeTotal += (float)$row['percentage'];
            $hasFee = true;
        }
    }
    if ($hasFee && abs($feeTotal - 100.0) > 0.01) {
        http_response_code(400);
        echo json_encode(['error' => "feeタイプの配分比率合計が100%ではありません（現在: {$feeTotal}%）"]);
        exit();
    }

    try {
        $pdo = getDB();
        $pdo->beginTransaction();

        // 全件削除
        $pdo->exec('DELETE FROM company_wallets');

        // 全件挿入
        $stmt = $pdo->prepare(
            'INSERT INTO company_wallets (label, wallet_address, percentage, wallet_type, sort_order)
             VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($wallets as $i => $row) {
            $stmt->execute([
                $row['label'],
                $row['wallet_address'],
                (float)$row['percentage'],
                $row['wallet_type'],
                isset($row['sort_order']) ? (int)$row['sort_order'] : $i,
            ]);
        }

        $pdo->commit();
        echo json_encode(['message' => '会社ウォレットを更新しました']);

    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
