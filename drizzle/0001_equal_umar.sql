CREATE TABLE `case_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`userId` int,
	`clientId` int,
	`assignmentType` enum('lawyer','assistant','client') NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedByUserId` int NOT NULL,
	CONSTRAINT `case_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`eventType` enum('note','status_change','document_upload','message','assignment','deadline','system') NOT NULL,
	`visibility` enum('internal','shared') NOT NULL DEFAULT 'internal',
	`title` varchar(255),
	`content` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`referenceNumber` varchar(100),
	`type` enum('civil','criminal','corporate','family','real_estate','employment','tax','immigration','intellectual_property','other') NOT NULL DEFAULT 'civil',
	`status` enum('open','pending','closed','archived') NOT NULL DEFAULT 'open',
	`description` text,
	`courtName` varchar(255),
	`courtFileNumber` varchar(100),
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`deadline` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`userId` int,
	`type` enum('individual','company') NOT NULL DEFAULT 'individual',
	`firstName` varchar(100),
	`lastName` varchar(100),
	`dateOfBirth` varchar(20),
	`companyName` varchar(255),
	`registrationNumber` varchar(100),
	`contactPerson` varchar(200),
	`email` varchar(320),
	`phone` varchar(50),
	`address` text,
	`city` varchar(100),
	`postalCode` varchar(20),
	`country` varchar(100) DEFAULT 'Switzerland',
	`notes` text,
	`status` enum('invited','active','inactive') NOT NULL DEFAULT 'invited',
	`termsAcceptedAt` timestamp,
	`onboardingCompletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`action` enum('view','download','upload','delete','version_upload') NOT NULL,
	`ipAddress` varchar(50),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`version` int NOT NULL,
	`fileKey` text NOT NULL,
	`fileUrl` text NOT NULL,
	`size` int NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`caseId` int NOT NULL,
	`folderId` int,
	`uploadedByUserId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`size` int NOT NULL,
	`fileKey` text NOT NULL,
	`fileUrl` text NOT NULL,
	`visibility` enum('internal','shared') NOT NULL DEFAULT 'internal',
	`currentVersion` int NOT NULL DEFAULT 1,
	`isDeleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `firm_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`userId` int NOT NULL,
	`firmRole` enum('admin','lawyer','assistant') NOT NULL DEFAULT 'lawyer',
	`title` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `firms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`address` text,
	`phone` varchar(50),
	`email` varchar(320),
	`website` varchar(255),
	`vatNumber` varchar(50),
	`logoUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firms_id` PRIMARY KEY(`id`),
	CONSTRAINT `firms_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('lawyer','assistant','client') NOT NULL,
	`token` varchar(128) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`clientId` int,
	`acceptedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`billingType` enum('hourly','flat_fee') NOT NULL DEFAULT 'flat_fee',
	`quantity` decimal(8,2) NOT NULL DEFAULT '1.00',
	`unitPrice` decimal(12,2) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`caseId` int,
	`clientId` int NOT NULL,
	`invoiceNumber` varchar(50) NOT NULL,
	`status` enum('draft','sent','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
	`issueDate` timestamp NOT NULL DEFAULT (now()),
	`dueDate` timestamp NOT NULL,
	`subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
	`vatRate` decimal(5,2) NOT NULL DEFAULT '7.70',
	`vatAmount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`notes` text,
	`stripePaymentIntentId` varchar(255),
	`stripePaymentUrl` text,
	`paidAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_reads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`firmId` int NOT NULL,
	`senderUserId` int NOT NULL,
	`content` text NOT NULL,
	`parentMessageId` int,
	`isDeleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
