<?php
/**
 * アクティビティログ記録ヘルパー
 *
 * @param int|null    $userId   操作者のユーザーID（NULLはシステム）
 * @param string      $action   アクション名
 * @param int|null    $targetId 対象ユーザーID
 * @param array       $details  詳細情報（JSON化して保存）
 */
function logActivity(?int $userId, string $action, ?int $targetId = null, array $details = []): void
{
    try {
        $pdo = getDB();
        $stmt = $pdo->prepare(
            'INSERT INTO activity_log (user_id, action, target_id, details, ip_address)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId,
            $action,
            $targetId,
            !empty($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ]);
    } catch (\Throwable $e) {
        // ログ記録失敗でメイン処理を止めない
    }
}
