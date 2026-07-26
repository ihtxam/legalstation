ALTER TABLE `adyen_accounts` ADD `hmacKey` text;
ALTER TABLE `adyen_accounts` ADD `environment` enum('test','live') NOT NULL DEFAULT 'test';
ALTER TABLE `adyen_accounts` ADD `lastWebhookAt` timestamp NULL;
ALTER TABLE `adyen_accounts` MODIFY `clientKey` text NULL;
ALTER TABLE `service_orders` ADD `adyenPaymentLinkId` varchar(255);
ALTER TABLE `service_orders` ADD `adyenPaymentLinkUrl` text;
