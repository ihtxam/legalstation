CREATE TABLE IF NOT EXISTS `calendar_connections` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `firmId` int,
  `provider` enum('google','microsoft','icloud') NOT NULL,
  `accountEmail` varchar(320),
  `accessTokenEnc` text,
  `refreshTokenEnc` text,
  `tokenExpiresAt` timestamp NULL,
  `externalCalendarId` varchar(512),
  `externalCalendarName` varchar(255),
  `caldavUrl` varchar(512),
  `caldavUsername` varchar(320),
  `syncEnabled` boolean NOT NULL DEFAULT true,
  `syncDirection` enum('both','push','pull') NOT NULL DEFAULT 'both',
  `lastSyncedAt` timestamp NULL,
  `lastError` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `calendar_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `calendar_personal_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `firmId` int,
  `title` varchar(255) NOT NULL,
  `description` text,
  `location` varchar(255),
  `startsAt` timestamp NOT NULL,
  `endsAt` timestamp NOT NULL,
  `allDay` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `calendar_personal_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `calendar_imported_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `connectionId` int NOT NULL,
  `userId` int NOT NULL,
  `externalEventId` varchar(512) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `location` varchar(255),
  `startsAt` timestamp NOT NULL,
  `endsAt` timestamp NOT NULL,
  `allDay` boolean NOT NULL DEFAULT false,
  `etag` varchar(255),
  `rawUpdatedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `calendar_imported_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `calendar_event_links` (
  `id` int AUTO_INCREMENT NOT NULL,
  `connectionId` int NOT NULL,
  `entityType` varchar(32) NOT NULL,
  `entityId` int NOT NULL,
  `externalEventId` varchar(512) NOT NULL,
  `etag` varchar(255),
  `lastPushedAt` timestamp NULL,
  `lastPulledAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `calendar_event_links_id` PRIMARY KEY(`id`)
);
