-- =============================================================
-- megamatch test users
-- password: admin1234
-- run bonus recalculation after executing
-- =============================================================
--
-- Tree:
--   MM_TopBronze (Bronze, invest=10,000) <- megamatch receiver
--   +-- MM_SubBronze (Bronze, invest=10,000) <- same rank -> same_rate 0.50%
--   |   +-- MM_Filler1 (none, invest=80,000)
--   |   +-- MM_Filler2 (none, invest=80,000)
--   +-- MM_SubSilver (Silver, invest=20,000) <- upper rank -> upper_rate 0.50%
--       +-- MM_Filler3 (none, invest=100,000)
--       +-- MM_Filler4 (none, invest=100,000)
--       +-- MM_Filler5 (none, invest=100,000)
-- =============================================================

-- 1. Top: Bronze (megamatch receiver)
INSERT INTO `users` (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`)
VALUES ('MM_TopBronze', 'mm_top@test.local',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'member', NULL, 10000.00, 'bronze');

-- 2. SubBronze (same rank)
INSERT INTO `users` (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`)
VALUES ('MM_SubBronze', 'mm_sub_bronze@test.local',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'member', (SELECT id FROM `users` u WHERE u.email = 'mm_top@test.local'), 10000.00, 'bronze');

-- 3. SubSilver (upper rank)
INSERT INTO `users` (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`)
VALUES ('MM_SubSilver', 'mm_sub_silver@test.local',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'member', (SELECT id FROM `users` u WHERE u.email = 'mm_top@test.local'), 20000.00, 'silver');

-- 4. Filler1 under SubBronze
INSERT INTO `users` (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`)
VALUES ('MM_Filler1', 'mm_filler1@test.local',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'member', (SELECT id FROM `users` u WHERE u.email = 'mm_sub_bronze@test.local'), 80000.00, 'none');

-- 5. Filler2 under SubBronze
INSERT INTO `users` (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`)
VALUES ('MM_Filler2', 'mm_filler2@test.local',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'member', (SELECT id FROM `users` u WHERE u.email = 'mm_sub_bronze@test.local'), 80000.00, 'none');

-- 6. Filler3 under SubSilver
INSERT INTO `users` (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`)
VALUES ('MM_Filler3', 'mm_filler3@test.local',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'member', (SELECT id FROM `users` u WHERE u.email = 'mm_sub_silver@test.local'), 100000.00, 'none');

-- 7. Filler4 under SubSilver
INSERT INTO `users` (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`)
VALUES ('MM_Filler4', 'mm_filler4@test.local',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'member', (SELECT id FROM `users` u WHERE u.email = 'mm_sub_silver@test.local'), 100000.00, 'none');

-- 8. Filler5 under SubSilver
INSERT INTO `users` (`name`, `email`, `password`, `role`, `referrer_id`, `investment_amount`, `rank`)
VALUES ('MM_Filler5', 'mm_filler5@test.local',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'member', (SELECT id FROM `users` u WHERE u.email = 'mm_sub_silver@test.local'), 100000.00, 'none');
