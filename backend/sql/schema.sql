-- =============================================================
-- CoinPool MLM Bonus Management System
-- Schema SQL
-- Charset: utf8mb4 / ENGINE: InnoDB
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- DROP TABLES (in reverse FK dependency order)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `bonus_snapshots`;
DROP TABLE IF EXISTS `pool_balance`;
DROP TABLE IF EXISTS `unilevel_rates`;
DROP TABLE IF EXISTS `rank_conditions`;
DROP TABLE IF EXISTS `users`;

-- -------------------------------------------------------------
-- TABLE: users
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id`                INT            NOT NULL AUTO_INCREMENT,
    `name`              VARCHAR(100)   NOT NULL,
    `email`             VARCHAR(255)   NOT NULL,
    `password`          VARCHAR(255)   NOT NULL COMMENT 'bcrypt hash',
    `role`              ENUM('admin','member') NOT NULL DEFAULT 'member',
    `referrer_id`       INT            NULL         COMMENT '紹介者 users.id',
    `investment_amount` DECIMAL(15,2)  NOT NULL DEFAULT 0.00 COMMENT '本人運用額',
    `rank`              ENUM('none','bronze','silver','gold','platinum','diamond') NOT NULL DEFAULT 'none',
    `created_at`        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`),
    KEY `idx_users_referrer_id` (`referrer_id`),
    CONSTRAINT `fk_users_referrer`
        FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ユーザー';

-- -------------------------------------------------------------
-- TABLE: rank_conditions
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rank_conditions` (
    `id`                      INT           NOT NULL AUTO_INCREMENT,
    `rank`                    ENUM('bronze','silver','gold','platinum','diamond') NOT NULL,
    `min_investment`          DECIMAL(15,2) NOT NULL COMMENT '本人最低運用額',
    `min_direct_referrals`    INT           NOT NULL COMMENT '最低直紹介人数',
    `min_group_investment`    DECIMAL(15,2) NOT NULL COMMENT 'グループ最低総運用額',
    `infinity_rate`           DECIMAL(5,2)  NOT NULL COMMENT 'インフィニティボーナス率(%)',
    `megamatch_same_rate`     DECIMAL(5,2)  NOT NULL COMMENT 'メガマッチ同ランク率(%)',
    `megamatch_upper_rate`    DECIMAL(5,2)  NOT NULL COMMENT 'メガマッチ上位ランク率(%)',
    `pool_distribution_rate`  DECIMAL(5,2)  NOT NULL COMMENT 'プール分配率(%)',
    `pool_contribution_rate`  DECIMAL(5,2)  NOT NULL COMMENT 'プール拠出率(%)',
    `updated_at`              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_rank_conditions_rank` (`rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ランク条件（管理者変更可）';

-- -------------------------------------------------------------
-- TABLE: unilevel_rates
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `unilevel_rates` (
    `id`    INT           NOT NULL AUTO_INCREMENT,
    `level` INT           NOT NULL COMMENT '1〜4',
    `rate`  DECIMAL(5,2)  NOT NULL COMMENT 'ユニレベルボーナス率(%)',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_unilevel_rates_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ユニレベルボーナス率（管理者変更可）';

-- -------------------------------------------------------------
-- TABLE: pool_balance
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pool_balance` (
    `id`         INT           NOT NULL AUTO_INCREMENT,
    `balance`    DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'グローバルエコプール残高',
    `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='グローバルエコプール残高';

-- -------------------------------------------------------------
-- TABLE: bonus_snapshots
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bonus_snapshots` (
    `id`              INT           NOT NULL AUTO_INCREMENT,
    `user_id`         INT           NOT NULL,
    `unilevel_bonus`  DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'ユニレベルボーナス',
    `infinity_bonus`  DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'インフィニティボーナス',
    `megamatch_bonus` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'メガマッチボーナス',
    `pool_bonus`      DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'プールボーナス',
    `total_bonus`     DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '合計ボーナス',
    `calculated_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'リアルタイム計算日時',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_bonus_snapshots_user_id` (`user_id`),
    KEY `idx_bonus_snapshots_calculated_at` (`calculated_at`),
    CONSTRAINT `fk_bonus_snapshots_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ボーナス計算結果スナップショット（リアルタイム更新）';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- INITIAL DATA
-- =============================================================

-- -------------------------------------------------------------
-- rank_conditions
-- -------------------------------------------------------------
INSERT INTO `rank_conditions`
    (`rank`, `min_investment`, `min_direct_referrals`, `min_group_investment`,
     `infinity_rate`, `megamatch_same_rate`, `megamatch_upper_rate`,
     `pool_distribution_rate`, `pool_contribution_rate`, `updated_at`)
VALUES
    ('bronze',   5000.00,  1,  100000.00, 0.50, 0.50, 0.50,  2.00,  1.00, NOW()),
    ('silver',  10000.00,  3,  300000.00, 1.00, 1.00, 0.75,  3.00,  2.00, NOW()),
    ('gold',    25000.00,  5, 1000000.00, 1.50, 1.50, 1.00,  5.00,  3.50, NOW()),
    ('platinum',50000.00,  7, 3000000.00, 2.00, 2.00, 1.50,  7.50,  6.00, NOW()),
    ('diamond', 100000.00, 10, 5000000.00, 3.00, 3.00, 0.00, 12.50,  7.50, NOW());

-- -------------------------------------------------------------
-- unilevel_rates
-- -------------------------------------------------------------
INSERT INTO `unilevel_rates` (`level`, `rate`) VALUES
    (1, 1.00),
    (2, 0.50),
    (3, 0.30),
    (4, 0.20);

-- -------------------------------------------------------------
-- pool_balance (initial record)
-- -------------------------------------------------------------
INSERT INTO `pool_balance` (`balance`, `updated_at`) VALUES (0.00, NOW());

-- -------------------------------------------------------------
-- admin user
-- Original password: admin1234
-- Hash generated by PHP: password_hash('admin1234', PASSWORD_BCRYPT)
-- -------------------------------------------------------------
INSERT INTO `users`
    (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`, `created_at`, `updated_at`)
VALUES
    (
        'Administrator',
        'admin@coinpool.com',
        '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        -- ^ bcrypt hash of 'admin1234' (cost=10), generated by PHP password_hash()
        'admin',
        NULL,
        0.00,
        'none',
        NOW(),
        NOW()
    );
