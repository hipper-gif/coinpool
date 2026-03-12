-- 手数料テーブル: 投資額レンジごとの会社手数料とアフィリエイト報酬
CREATE TABLE IF NOT EXISTS fee_table (
  id INT NOT NULL AUTO_INCREMENT,
  min_amount DECIMAL(15,2) NOT NULL,
  max_amount DECIMAL(15,2) NULL COMMENT 'NULLは上限なし',
  company_fee_rate DECIMAL(5,2) NOT NULL COMMENT '会社手数料%',
  affiliate_fee_rate DECIMAL(5,2) NOT NULL COMMENT 'アフィリエイト報酬%',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 初期データ
INSERT INTO fee_table (min_amount, max_amount, company_fee_rate, affiliate_fee_rate) VALUES
  (1000.00,    3000.00,  45.00, 15.00),
  (3000.00,    5000.00,  35.00, 15.00),
  (5000.00,   10000.00,  30.00, 15.00),
  (10000.00,  30000.00,  28.00, 12.00),
  (30000.00,  50000.00,  25.00, 10.00),
  (50000.00, 100000.00,  23.00,  7.00),
  (100000.00,300000.00,  21.00,  5.00),
  (300000.00,     NULL,  18.00,  5.00);
