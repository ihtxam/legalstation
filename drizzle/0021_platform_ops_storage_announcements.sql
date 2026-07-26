ALTER TABLE `firms` ADD `storageQuotaBytes` bigint NOT NULL DEFAULT 10737418240;

CREATE TABLE IF NOT EXISTS `platform_announcements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
  `audience` enum('firm_admins','all_members') NOT NULL DEFAULT 'firm_admins',
  `isActive` boolean NOT NULL DEFAULT true,
  `startsAt` timestamp NOT NULL DEFAULT (now()),
  `endsAt` timestamp NULL,
  `createdByUserId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `platform_announcements_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `announcement_dismissals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `announcementId` int NOT NULL,
  `userId` int NOT NULL,
  `dismissedAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `announcement_dismissals_id` PRIMARY KEY(`id`)
);
