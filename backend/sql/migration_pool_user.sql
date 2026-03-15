-- =============================================================
-- Migration: プール用アカウント追加
-- users.role に 'pool' を追加し、プール用ユーザーを作成
-- =============================================================

-- 1. role ENUM に 'pool' を追加
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('root','admin','member','pool') NOT NULL DEFAULT 'member';

-- 2. プール用ユーザーを作成（存在しない場合のみ）
INSERT INTO `users`
    (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`, `created_at`, `updated_at`)
SELECT
    'Pool',
    'pool@coinpool.system',
    '$2y$10$no.login.allowed.pool.account.placeholder.hash.value',
    'pool',
    NULL,
    0.00,
    'none',
    NOW(),
    NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `role` = 'pool' LIMIT 1);
