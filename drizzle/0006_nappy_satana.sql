CREATE TABLE `document_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`summary` text,
	`keyPoints` text,
	`sentiment` varchar(50),
	`documentType` varchar(100),
	`wordCount` int,
	`readingTime` int,
	`extractedEntities` text,
	`status` enum('pending','analyzing','completed','failed') NOT NULL DEFAULT 'pending',
	`error` text,
	`analyzedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_summaries_id` PRIMARY KEY(`id`)
);
