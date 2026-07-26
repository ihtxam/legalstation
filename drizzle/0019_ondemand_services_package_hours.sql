ALTER TABLE `firm_client_packages` ADD `consultationHoursPerPeriod` decimal(6,2) NOT NULL DEFAULT '0.00';
ALTER TABLE `firm_client_packages` ADD `includedFixedHours` decimal(6,2) NOT NULL DEFAULT '0.00';
ALTER TABLE `firm_client_packages` ADD `highlightLabel` varchar(64);

CREATE TABLE IF NOT EXISTS `firm_ondemand_services` (
  `id` int AUTO_INCREMENT NOT NULL,
  `firmId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category` enum('advice','contract','documents','employment','corporate','other') NOT NULL DEFAULT 'advice',
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(3) NOT NULL DEFAULT 'CHF',
  `estimatedHours` decimal(6,2) NOT NULL DEFAULT '1.00',
  `deliveryNotes` text,
  `defaultCaseType` enum('civil','criminal','corporate','family','real_estate','employment','tax','immigration','intellectual_property','other') NOT NULL DEFAULT 'other',
  `isActive` boolean NOT NULL DEFAULT true,
  `isPublic` boolean NOT NULL DEFAULT true,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `firm_ondemand_services_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `service_orders` (
  `id` int AUTO_INCREMENT NOT NULL,
  `firmId` int NOT NULL,
  `clientId` int NOT NULL,
  `orderNumber` varchar(32) NOT NULL,
  `status` enum('cart','pending_payment','paid','awaiting_acceptance','accepted','in_progress','completed','cancelled','rejected') NOT NULL DEFAULT 'cart',
  `subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(3) NOT NULL DEFAULT 'CHF',
  `clientNotes` text,
  `stripeCheckoutSessionId` varchar(255),
  `stripePaymentUrl` text,
  `paidAt` timestamp NULL,
  `acceptedAt` timestamp NULL,
  `rejectedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `acceptedByUserId` int,
  `assignedLawyerUserId` int,
  `caseId` int,
  `rejectionReason` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `service_orders_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `service_order_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `serviceId` int NOT NULL,
  `serviceName` varchar(255) NOT NULL,
  `unitPrice` decimal(10,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT 1,
  `currency` varchar(3) NOT NULL DEFAULT 'CHF',
  `estimatedHours` decimal(6,2) NOT NULL DEFAULT '1.00',
  `clientBrief` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `service_order_items_id` PRIMARY KEY(`id`)
);
