CREATE TABLE IF NOT EXISTS monthly_reports (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  `year_month` VARCHAR(7) NOT NULL COMMENT 'YYYY-MM形式',
  unilevel_bonus DECIMAL(15,2) NOT NULL DEFAULT 0,
  infinity_bonus DECIMAL(15,2) NOT NULL DEFAULT 0,
  megamatch_bonus DECIMAL(15,2) NOT NULL DEFAULT 0,
  pool_bonus DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_bonus DECIMAL(15,2) NOT NULL DEFAULT 0,
  pool_contribution DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT 'プール拠出額',
  net_bonus DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '実質受取額(total - pool_contribution)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_monthly_user (user_id, `year_month`),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
