-- =============================================================
-- Migration: MegaMatch条件カラム追加
-- rank_conditionsテーブルにメガマッチ専用の昇格条件を追加
-- =============================================================

ALTER TABLE rank_conditions
  ADD COLUMN mm_min_investment DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'メガマッチ最低本人運用額' AFTER min_group_investment,
  ADD COLUMN mm_min_direct_referrals INT NOT NULL DEFAULT 0 COMMENT 'メガマッチ最低直紹介人数' AFTER mm_min_investment,
  ADD COLUMN mm_min_group_investment DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'メガマッチ最低グループ運用額' AFTER mm_min_direct_referrals;

-- PDFボーナスプラン仕様に基づく初期値設定
UPDATE rank_conditions SET mm_min_investment = 10000.00,  mm_min_direct_referrals = 1,  mm_min_group_investment = 150000.00   WHERE `rank` = 'bronze';
UPDATE rank_conditions SET mm_min_investment = 20000.00,  mm_min_direct_referrals = 3,  mm_min_group_investment = 500000.00   WHERE `rank` = 'silver';
UPDATE rank_conditions SET mm_min_investment = 50000.00,  mm_min_direct_referrals = 5,  mm_min_group_investment = 1500000.00  WHERE `rank` = 'gold';
UPDATE rank_conditions SET mm_min_investment = 75000.00,  mm_min_direct_referrals = 7,  mm_min_group_investment = 5000000.00  WHERE `rank` = 'platinum';
UPDATE rank_conditions SET mm_min_investment = 150000.00, mm_min_direct_referrals = 10, mm_min_group_investment = 7500000.00  WHERE `rank` = 'diamond';
