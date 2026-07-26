CREATE TABLE `active_timers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`lawyerId` int NOT NULL,
	`caseId` int NOT NULL,
	`description` text NOT NULL DEFAULT (''),
	`startedAt` timestamp NOT NULL,
	`accumulatedSeconds` int NOT NULL DEFAULT 0,
	`isPaused` boolean NOT NULL DEFAULT false,
	`pausedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `active_timers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcement_dismissals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`announcementId` int NOT NULL,
	`userId` int NOT NULL,
	`dismissedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcement_dismissals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`firmId` int,
	`provider` enum('google','microsoft','icloud') NOT NULL,
	`accountEmail` varchar(320),
	`accessTokenEnc` text,
	`refreshTokenEnc` text,
	`tokenExpiresAt` timestamp,
	`externalCalendarId` varchar(512),
	`externalCalendarName` varchar(255),
	`caldavUrl` varchar(512),
	`caldavUsername` varchar(320),
	`syncEnabled` boolean NOT NULL DEFAULT true,
	`syncDirection` enum('both','push','pull') NOT NULL DEFAULT 'both',
	`lastSyncedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_event_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectionId` int NOT NULL,
	`entityType` varchar(32) NOT NULL,
	`entityId` int NOT NULL,
	`externalEventId` varchar(512) NOT NULL,
	`etag` varchar(255),
	`lastPushedAt` timestamp,
	`lastPulledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_event_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_imported_events` (
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
	`rawUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_imported_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_personal_events` (
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
CREATE TABLE `case_intake_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`caseId` int NOT NULL,
	`clientId` int NOT NULL,
	`formVersion` varchar(32) NOT NULL DEFAULT 'intake_v1',
	`privacyLevel` enum('private','sensitive','standard') NOT NULL DEFAULT 'standard',
	`relatedLawArea` varchar(64),
	`desiredOutcome` text,
	`happenedAt` varchar(100),
	`howItHappened` text,
	`involvement` text,
	`answersJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_intake_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `client_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`clientId` int NOT NULL,
	`packageId` int NOT NULL,
	`status` enum('active','past_due','cancelled','expired') NOT NULL DEFAULT 'active',
	`billingInterval` enum('monthly','biannual','yearly') NOT NULL DEFAULT 'monthly',
	`currentPeriodStart` timestamp NOT NULL,
	`currentPeriodEnd` timestamp NOT NULL,
	`commitmentEndsAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `firm_client_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`billingInterval` enum('monthly','biannual','yearly') NOT NULL DEFAULT 'monthly',
	`monthlyPrice` decimal(10,2) NOT NULL DEFAULT '0.00',
	`biannualPrice` decimal(10,2),
	`yearlyPrice` decimal(10,2),
	`minCommitmentMonths` int NOT NULL DEFAULT 12,
	`casesPerPeriod` int NOT NULL DEFAULT 1,
	`consultationHoursPerPeriod` decimal(6,2) NOT NULL DEFAULT '0.00',
	`includedFixedHours` decimal(6,2) NOT NULL DEFAULT '0.00',
	`highlightLabel` varchar(64),
	`allowedCaseTypes` text,
	`features` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`isPublic` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_client_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `firm_ondemand_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` enum('advice','contract','documents','employment','corporate','other') NOT NULL DEFAULT 'advice',
	`fulfillmentType` enum('document','consultation') NOT NULL DEFAULT 'document',
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`estimatedHours` decimal(6,2) NOT NULL DEFAULT '1.00',
	`deliveryNotes` text,
	`defaultCaseType` enum('civil','criminal','corporate','family','real_estate','employment','tax','immigration','intellectual_property','other') NOT NULL DEFAULT 'other',
	`isActive` boolean NOT NULL DEFAULT true,
	`isPublic` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_ondemand_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `matter_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`color` varchar(7) DEFAULT '#7C3AED',
	`isClosedStage` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matter_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`audience` enum('firm_admins','all_members') NOT NULL DEFAULT 'firm_admins',
	`isActive` boolean NOT NULL DEFAULT true,
	`startsAt` timestamp NOT NULL DEFAULT (now()),
	`endsAt` timestamp,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_announcements_id` PRIMARY KEY(`id`)
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
--> statement-breakpoint
CREATE TABLE `service_order_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`firmId` int NOT NULL,
	`kind` enum('client_source','firm_deliverable') NOT NULL,
	`round` int NOT NULL DEFAULT 1,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(128),
	`size` int NOT NULL DEFAULT 0,
	`description` text,
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_order_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`firmId` int NOT NULL,
	`type` enum('intake_submitted','assigned','delivered','revision_requested','completed','remark','locked','system') NOT NULL,
	`body` text,
	`authorUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`serviceId` int NOT NULL,
	`serviceName` varchar(255) NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`estimatedHours` decimal(6,2) NOT NULL DEFAULT '1.00',
	`clientBrief` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`clientId` int NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`status` enum('cart','pending_payment','paid','awaiting_acceptance','awaiting_intake','ready_for_firm','accepted','in_progress','delivered','revision_requested','completed','cancelled','rejected') NOT NULL DEFAULT 'cart',
	`subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'CHF',
	`fulfillmentType` enum('document','consultation') NOT NULL DEFAULT 'document',
	`clientNotes` text,
	`intakeDescription` text,
	`intakeSubmittedAt` timestamp,
	`maxRevisions` int NOT NULL DEFAULT 2,
	`revisionsUsed` int NOT NULL DEFAULT 0,
	`lawyerRemarks` text,
	`lastDeliveredAt` timestamp,
	`stripeCheckoutSessionId` varchar(255),
	`stripePaymentUrl` text,
	`adyenPaymentLinkId` varchar(255),
	`adyenPaymentLinkUrl` text,
	`paidAt` timestamp,
	`acceptedAt` timestamp,
	`rejectedAt` timestamp,
	`completedAt` timestamp,
	`lockedAt` timestamp,
	`acceptedByUserId` int,
	`assignedLawyerUserId` int,
	`caseId` int,
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_ticket_attachments` (
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
--> statement-breakpoint
CREATE TABLE `support_ticket_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`authorKind` enum('firm','superadmin') NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketNumber` varchar(32) NOT NULL,
	`firmId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`sensitivity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','processing','under_review','responded','resolved','closed') NOT NULL DEFAULT 'open',
	`resolvedAt` timestamp,
	`autoCloseAt` timestamp,
	`closedAt` timestamp,
	`lastFirmReplyAt` timestamp,
	`lastSuperadminReplyAt` timestamp,
	`firmLastViewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `support_tickets_ticketNumber_unique` UNIQUE(`ticketNumber`)
);
--> statement-breakpoint
ALTER TABLE `adyen_accounts` MODIFY COLUMN `clientKey` text;--> statement-breakpoint
ALTER TABLE `firm_members` MODIFY COLUMN `firmRole` enum('admin','subadmin','lawyer','assistant') NOT NULL DEFAULT 'lawyer';--> statement-breakpoint
ALTER TABLE `firm_subscriptions` MODIFY COLUMN `status` enum('trialing','active','past_due','cancelled','suspended') NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `invitations` MODIFY COLUMN `role` enum('subadmin','lawyer','assistant','client') NOT NULL;--> statement-breakpoint
ALTER TABLE `adyen_accounts` ADD `hmacKey` text;--> statement-breakpoint
ALTER TABLE `adyen_accounts` ADD `environment` enum('test','live') DEFAULT 'test' NOT NULL;--> statement-breakpoint
ALTER TABLE `adyen_accounts` ADD `lastWebhookAt` timestamp;--> statement-breakpoint
ALTER TABLE `cases` ADD `matterStageId` int;--> statement-breakpoint
ALTER TABLE `clients` ADD `accessType` enum('standard','subscriber') DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `description` text;--> statement-breakpoint
ALTER TABLE `firm_subscriptions` ADD `trialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `firms` ADD `defaultCurrency` varchar(3) DEFAULT 'CHF' NOT NULL;--> statement-breakpoint
ALTER TABLE `firms` ADD `defaultVatRate` decimal(5,2) DEFAULT '8.10' NOT NULL;--> statement-breakpoint
ALTER TABLE `firms` ADD `primaryColor` varchar(7) DEFAULT '#00BFA6';--> statement-breakpoint
ALTER TABLE `firms` ADD `secondaryColor` varchar(7) DEFAULT '#64748B';--> statement-breakpoint
ALTER TABLE `firms` ADD `customDomain` varchar(255);--> statement-breakpoint
ALTER TABLE `firms` ADD `subdomainStatus` enum('none','pending','active','rejected') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `firms` ADD `onboardingStep` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `firms` ADD `onboardingCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `firms` ADD `credentialsSentAt` timestamp;--> statement-breakpoint
ALTER TABLE `firms` ADD `maxUploadBytes` int DEFAULT 10485760 NOT NULL;--> statement-breakpoint
ALTER TABLE `firms` ADD `storageQuotaBytes` bigint DEFAULT 10737418240 NOT NULL;--> statement-breakpoint
ALTER TABLE `firms` ADD `allowedUploadTypes` text;--> statement-breakpoint
ALTER TABLE `firms` ADD `iban` varchar(34);--> statement-breakpoint
ALTER TABLE `firms` ADD `qrIban` varchar(34);--> statement-breakpoint
ALTER TABLE `firms` ADD `creditorStreet` varchar(70);--> statement-breakpoint
ALTER TABLE `firms` ADD `creditorBuildingNumber` varchar(16);--> statement-breakpoint
ALTER TABLE `firms` ADD `creditorPostalCode` varchar(16);--> statement-breakpoint
ALTER TABLE `firms` ADD `creditorCity` varchar(35);--> statement-breakpoint
ALTER TABLE `firms` ADD `creditorCountry` varchar(2) DEFAULT 'CH';--> statement-breakpoint
ALTER TABLE `firms` ADD `roleCapabilityOverrides` text;--> statement-breakpoint
ALTER TABLE `invitations` ADD `emailLanguage` varchar(5) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_installments` ADD `generatedInvoiceId` int;--> statement-breakpoint
ALTER TABLE `payment_plans` ADD `autoGenerateInvoices` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_plans` ADD `autoSendInvoices` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totpSecret` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `totpEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `preferredLocale` varchar(5) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE `adyen_accounts` ADD CONSTRAINT `adyen_accounts_firmId_unique` UNIQUE(`firmId`);