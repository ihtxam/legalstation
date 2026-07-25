ALTER TABLE `firms` ADD `iban` varchar(34);
ALTER TABLE `firms` ADD `qrIban` varchar(34);
ALTER TABLE `firms` ADD `creditorStreet` varchar(70);
ALTER TABLE `firms` ADD `creditorBuildingNumber` varchar(16);
ALTER TABLE `firms` ADD `creditorPostalCode` varchar(16);
ALTER TABLE `firms` ADD `creditorCity` varchar(35);
ALTER TABLE `firms` ADD `creditorCountry` varchar(2) DEFAULT 'CH';
ALTER TABLE `payment_plans` ADD `autoSendInvoices` boolean NOT NULL DEFAULT true;
