ALTER TABLE `firm_subscriptions` MODIFY COLUMN `status` enum('trialing','active','past_due','cancelled','suspended') NOT NULL DEFAULT 'active';
ALTER TABLE `firm_subscriptions` ADD `trialEndsAt` timestamp;
