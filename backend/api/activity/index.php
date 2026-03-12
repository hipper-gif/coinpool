<?php
// backend/api/activity/index.php  (GET: アクティビティログ一覧)
// 管理者のみ

session_start();
require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';

$requireAdmin = true;
require_once __DIR__ . '/../../config/auth_check.php';

// ---------------------------------------------------------------
// GET: アクティビティログ一覧
// ---------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $pdo = getDB();

        $limit  = max(1, min(100, (int)($_GET['limit']  ?? 50)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));
        $action = isset($_GET['action']) && $_GET['action'] !== '' ? $_GET['action'] : null;

        // WHERE句の組み立て
        $where  = '';
        $params = [];
        if ($action !== null) {
            $where  = 'WHERE a.action = ?';
            $params[] = $action;
        }

        // 総件数
        $countSql = "SELECT COUNT(*) FROM activity_log a {$where}";
        $stmt = $pdo->prepare($countSql);
        $stmt->execute($params);
        $total = (int)$stmt->fetchColumn();

        // ログ取得（usersテーブルとJOIN）
        $sql = "SELECT a.id, a.user_id, u.name AS user_name,
                       a.action, a.target_id, t.name AS target_name,
                       a.details, a.ip_address, a.created_at
                FROM activity_log a
                LEFT JOIN users u ON u.id = a.user_id
                LEFT JOIN users t ON t.id = a.target_id
                {$where}
                ORDER BY a.created_at DESC
                LIMIT ? OFFSET ?";
        $fetchParams = array_merge($params, [$limit, $offset]);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($fetchParams);
        $rows = $stmt->fetchAll();

        $logs = [];
        foreach ($rows as $row) {
            $logs[] = [
                'id'         => (int)$row['id'],
                'user_name'  => $row['user_name'],
                'action'     => $row['action'],
                'target_name'=> $row['target_name'],
                'details'    => $row['details'],
                'ip_address' => $row['ip_address'],
                'created_at' => $row['created_at'],
            ];
        }

        echo json_encode(['logs' => $logs, 'total' => $total]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'サーバーエラーが発生しました']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
