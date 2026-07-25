CREATE TABLE `document_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`caseId` int NOT NULL,
	`requestedByUserId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('pending','fulfilled','cancelled') NOT NULL DEFAULT 'pending',
	`dueDate` timestamp,
	`fulfilledDocumentId` int,
	`fulfilledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('demo','signup') NOT NULL,
	`firmName` varchar(255) NOT NULL,
	`contactName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`message` text,
	`status` enum('new','contacted','qualified','closed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_leads_id` PRIMARY KEY(`id`)
);
