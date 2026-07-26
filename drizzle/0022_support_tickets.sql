CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ticketNumber` varchar(32) NOT NULL,
  `firmId` int NOT NULL,
  `createdByUserId` int NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `sensitivity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `status` enum('open','processing','under_review','responded','resolved','closed') NOT NULL DEFAULT 'open',
  `resolvedAt` timestamp NULL,
  `autoCloseAt` timestamp NULL,
  `closedAt` timestamp NULL,
  `lastFirmReplyAt` timestamp NULL,
  `lastSuperadminReplyAt` timestamp NULL,
  `firmLastViewedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`),
  CONSTRAINT `support_tickets_ticketNumber_unique` UNIQUE(`ticketNumber`)
);

CREATE TABLE IF NOT EXISTS `support_ticket_messages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ticketId` int NOT NULL,
  `authorUserId` int NOT NULL,
  `authorKind` enum('firm','superadmin') NOT NULL,
  `body` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `support_ticket_messages_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `support_ticket_attachments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `ticketId` int NOT NULL,
  `messageId` int,
  `fileName` varchar(255) NOT NULL,
  `fileKey` varchar(512) NOT NULL,
  `fileUrl` varchar(1024) NOT NULL,
  `mimeType` varchar(128),
  `size` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `support_ticket_attachments_id` PRIMARY KEY(`id`)
);

CREATE INDEX `support_tickets_firmId_idx` ON `support_tickets` (`firmId`);
CREATE INDEX `support_tickets_status_idx` ON `support_tickets` (`status`);
CREATE INDEX `support_ticket_messages_ticketId_idx` ON `support_ticket_messages` (`ticketId`);
