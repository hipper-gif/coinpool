-- 会社ウォレット管理テーブル
CREATE TABLE IF NOT EXISTS company_wallets (
  id INT NOT NULL AUTO_INCREMENT,
  label VARCHAR(100) NOT NULL COMMENT '用途ラベル（例: 運営費, マーケティング）',
  wallet_address VARCHAR(255) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '会社手数料内の配分比率%（feeタイプは合計100%）',
  wallet_type ENUM('fee','pool') NOT NULL DEFAULT 'fee' COMMENT 'fee=手数料配分先, pool=プール拠出先',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会社ウォレットアドレス管理';
