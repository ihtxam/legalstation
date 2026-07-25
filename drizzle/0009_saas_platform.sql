ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE `firms` ADD `defaultCurrency` varchar(3) NOT NULL DEFAULT 'CHF';--> statement-breakpoint
ALTER TABLE `firms` ADD `defaultVatRate` decimal(5,2) NOT NULL DEFAULT '8.10';--> statement-breakpoint
ALTER TABLE `firms` ADD `primaryColor` varchar(7) DEFAULT '#001f3f';--> statement-breakpoint
ALTER TABLE `firms` ADD `secondaryColor` varchar(7) DEFAULT '#c9a227';--> statement-breakpoint
ALTER TABLE `firms` ADD `customDomain` varchar(255);--> statement-breakpoint
ALTER TABLE `firms` ADD `subdomainStatus` enum('none','pending','active','rejected') NOT NULL DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `firms` ADD `onboardingStep` int NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `firms` ADD `onboardingCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `firms` ADD `credentialsSentAt` timestamp;--> statement-breakpoint
CREATE TABLE `active_timers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`lawyerId` int NOT NULL,
	`caseId` int NOT NULL,
	`description` text NOT NULL,
	`startedAt` timestamp NOT NULL,
	`accumulatedSeconds` int NOT NULL DEFAULT 0,
	`isPaused` boolean NOT NULL DEFAULT false,
	`pausedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `active_timers_id` PRIMARY KEY(`id`)
);
