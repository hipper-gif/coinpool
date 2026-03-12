CREATE TABLE IF NOT EXISTS activity_log (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NULL COMMENT '操作者（NULLはシステム）',
  action VARCHAR(50) NOT NULL COMMENT 'login/logout/member_add/member_delete/investment_update/settings_update/report_confirm',
  target_id INT NULL COMMENT '対象ユーザーID',
  details TEXT NULL COMMENT 'JSON形式の詳細',
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_user (user_id),
  KEY idx_activity_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
