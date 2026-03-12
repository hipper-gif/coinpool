-- =============================================================
-- CoinPool MLM Bonus Management System
-- system_settings テーブル
-- Charset: utf8mb4 / ENGINE: InnoDB
-- =============================================================

SET NAMES utf8mb4;

-- -------------------------------------------------------------
-- TABLE: system_settings
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
    `id`            INT          NOT NULL AUTO_INCREMENT,
    `setting_key`   VARCHAR(100) NOT NULL COMMENT '設定キー',
    `setting_value` TEXT         NOT NULL COMMENT '設定値',
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_system_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='システム設定（管理者変更可）';

-- -------------------------------------------------------------
-- INITIAL DATA
-- -------------------------------------------------------------
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `updated_at`)
VALUES
    ('bonus_cap_rate', '5.0', NOW());
