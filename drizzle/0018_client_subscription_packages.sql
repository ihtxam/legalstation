ALTER TABLE `clients` ADD `accessType` enum('standard','subscriber') NOT NULL DEFAULT 'standard';

CREATE TABLE IF NOT EXISTS `firm_client_packages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `firmId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(3) NOT NULL DEFAULT 'CHF',
  `billingInterval` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
  `casesPerPeriod` int NOT NULL DEFAULT 1,
  `allowedCaseTypes` text,
  `features` text,
  `isActive` boolean NOT NULL DEFAULT true,
  `isPublic` boolean NOT NULL DEFAULT true,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `firm_client_packages_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `client_subscriptions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `firmId` int NOT NULL,
  `clientId` int NOT NULL,
  `packageId` int NOT NULL,
  `status` enum('active','past_due','cancelled','expired') NOT NULL DEFAULT 'active',
  `billingInterval` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
  `currentPeriodStart` timestamp NOT NULL,
  `currentPeriodEnd` timestamp NOT NULL,
  `cancelledAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `client_subscriptions_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `case_intake_submissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `firmId` int NOT NULL,
  `caseId` int NOT NULL,
  `clientId` int NOT NULL,
  `formVersion` varchar(32) NOT NULL DEFAULT 'intake_v1',
  `privacyLevel` enum('private','sensitive','standard') NOT NULL DEFAULT 'standard',
  `relatedLawArea` varchar(64),
  `desiredOutcome` text,
  `happenedAt` varchar(100),
  `howItHappened` text,
  `involvement` text,
  `answersJson` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `case_intake_submissions_id` PRIMARY KEY(`id`)
);
