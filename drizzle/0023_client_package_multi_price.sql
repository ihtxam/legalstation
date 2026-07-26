-- Multi-price client packages: monthly / biannual / yearly; yearly entitlements; 1-year minimum commitment

ALTER TABLE `firm_client_packages`
  ADD COLUMN `monthlyPrice` decimal(10,2) NOT NULL DEFAULT '0.00' AFTER `price`,
  ADD COLUMN `biannualPrice` decimal(10,2) NULL AFTER `monthlyPrice`,
  ADD COLUMN `yearlyPrice` decimal(10,2) NULL AFTER `biannualPrice`,
  ADD COLUMN `minCommitmentMonths` int NOT NULL DEFAULT 12 AFTER `yearlyPrice`;

-- Backfill prices from legacy single price + interval
UPDATE `firm_client_packages`
SET `monthlyPrice` = `price`
WHERE `billingInterval` = 'monthly';

UPDATE `firm_client_packages`
SET `yearlyPrice` = `price`,
    `monthlyPrice` = ROUND(`price` / 12, 2)
WHERE `billingInterval` = 'yearly';

UPDATE `firm_client_packages`
SET `yearlyPrice` = ROUND(`monthlyPrice` * 12, 2)
WHERE `yearlyPrice` IS NULL;

UPDATE `firm_client_packages`
SET `biannualPrice` = ROUND(COALESCE(`yearlyPrice`, `monthlyPrice` * 12) / 2, 2)
WHERE `biannualPrice` IS NULL;

ALTER TABLE `firm_client_packages`
  MODIFY COLUMN `billingInterval` enum('monthly','biannual','yearly') NOT NULL DEFAULT 'monthly';

ALTER TABLE `client_subscriptions`
  MODIFY COLUMN `billingInterval` enum('monthly','biannual','yearly') NOT NULL DEFAULT 'monthly',
  ADD COLUMN `commitmentEndsAt` timestamp NULL AFTER `currentPeriodEnd`;

-- Existing active subs: 1-year commitment from start
UPDATE `client_subscriptions`
SET `commitmentEndsAt` = DATE_ADD(`currentPeriodStart`, INTERVAL 12 MONTH)
WHERE `commitmentEndsAt` IS NULL;
