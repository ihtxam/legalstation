CREATE TABLE `lawyer_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`lawyerId` int NOT NULL,
	`hourlyRate` decimal(10,2) NOT NULL,
	`effectiveFrom` timestamp NOT NULL DEFAULT (now()),
	`effectiveTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lawyer_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`caseId` int NOT NULL,
	`lawyerId` int NOT NULL,
	`description` text NOT NULL,
	`durationMinutes` int NOT NULL,
	`hourlyRate` decimal(10,2),
	`billable` boolean NOT NULL DEFAULT true,
	`invoiceItemId` int,
	`status` enum('draft','submitted','billed') NOT NULL DEFAULT 'draft',
	`date` timestamp NOT NULL,
	`startTime` timestamp,
	`endTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entry_tag_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timeEntryId` int NOT NULL,
	`tagId` int NOT NULL,
	CONSTRAINT `time_entry_tag_mappings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entry_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(7) DEFAULT '#3B82F6',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `time_entry_tags_id` PRIMARY KEY(`id`)
);
