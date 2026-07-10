CREATE TABLE `adyen_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`merchantAccount` varchar(255) NOT NULL,
	`apiKey` text NOT NULL,
	`clientKey` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `adyen_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agency_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agency_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `agency_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `firm_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`planId` int NOT NULL,
	`billingCycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
	`status` enum('active','past_due','cancelled','suspended') NOT NULL DEFAULT 'active',
	`currentPeriodStart` timestamp NOT NULL,
	`currentPeriodEnd` timestamp NOT NULL,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_installments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentPlanId` int NOT NULL,
	`installmentNumber` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`dueDate` timestamp NOT NULL,
	`status` enum('pending','paid','overdue','failed') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`adyenPaymentId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_installments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`totalAmount` decimal(12,2) NOT NULL,
	`installmentCount` int NOT NULL,
	`intervalDays` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`maxUsers` int NOT NULL,
	`monthlyPrice` decimal(10,2) NOT NULL,
	`yearlyPrice` decimal(10,2) NOT NULL,
	`features` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `superadmin_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`superadminId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`targetType` varchar(50) NOT NULL,
	`targetId` int,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `superadmin_audit_log_id` PRIMARY KEY(`id`)
);
