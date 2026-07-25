ALTER TABLE `cases` ADD `matterStageId` int;
CREATE TABLE `matter_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`color` varchar(7) DEFAULT '#001f3f',
	`isClosedStage` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matter_stages_id` PRIMARY KEY(`id`)
);
CREATE TABLE `case_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`caseId` int NOT NULL,
	`parentTaskId` int,
	`matterStageId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('todo','in_progress','done','cancelled') NOT NULL DEFAULT 'todo',
	`assigneeUserId` int,
	`dueAt` timestamp,
	`mentionedUserIds` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_tasks_id` PRIMARY KEY(`id`)
);
CREATE TABLE `client_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`clientId` int NOT NULL,
	`type` enum('note','meeting','todo','next_action','reminder') NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`dueAt` timestamp,
	`remindAt` timestamp,
	`assigneeUserId` int,
	`mentionedUserIds` text,
	`completedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_activities_id` PRIMARY KEY(`id`)
);
CREATE TABLE `firm_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`contactName` varchar(200) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`company` varchar(255),
	`source` varchar(100),
	`stage` enum('new','contacted','qualified','consultation','proposal','won','lost') NOT NULL DEFAULT 'new',
	`notes` text,
	`assignedUserId` int,
	`convertedClientId` int,
	`convertedCaseId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_leads_id` PRIMARY KEY(`id`)
);
CREATE TABLE `firm_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`slug` varchar(120) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text,
	`isHome` boolean NOT NULL DEFAULT false,
	`published` boolean NOT NULL DEFAULT false,
	`seoTitle` varchar(255),
	`seoDescription` varchar(500),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_pages_id` PRIMARY KEY(`id`)
);
