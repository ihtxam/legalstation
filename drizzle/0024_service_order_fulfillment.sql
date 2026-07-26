-- On-demand order fulfillment: client intake, deliverables, revisions, 7-day lock

ALTER TABLE `firm_ondemand_services`
  ADD COLUMN `fulfillmentType` enum('document','consultation') NOT NULL DEFAULT 'document' AFTER `category`;

UPDATE `firm_ondemand_services`
SET `fulfillmentType` = 'consultation'
WHERE `category` = 'advice';

ALTER TABLE `service_orders`
  MODIFY COLUMN `status` enum(
    'cart',
    'pending_payment',
    'paid',
    'awaiting_acceptance',
    'awaiting_intake',
    'ready_for_firm',
    'accepted',
    'in_progress',
    'delivered',
    'revision_requested',
    'completed',
    'cancelled',
    'rejected'
  ) NOT NULL DEFAULT 'cart';

ALTER TABLE `service_orders`
  ADD COLUMN `fulfillmentType` enum('document','consultation') NOT NULL DEFAULT 'document' AFTER `currency`,
  ADD COLUMN `intakeDescription` text NULL AFTER `clientNotes`,
  ADD COLUMN `intakeSubmittedAt` timestamp NULL AFTER `intakeDescription`,
  ADD COLUMN `maxRevisions` int NOT NULL DEFAULT 2 AFTER `intakeSubmittedAt`,
  ADD COLUMN `revisionsUsed` int NOT NULL DEFAULT 0 AFTER `maxRevisions`,
  ADD COLUMN `lawyerRemarks` text NULL AFTER `revisionsUsed`,
  ADD COLUMN `lastDeliveredAt` timestamp NULL AFTER `lawyerRemarks`,
  ADD COLUMN `lockedAt` timestamp NULL AFTER `completedAt`;

-- Paid orders waiting for firm: move into awaiting_intake so clients can submit materials
UPDATE `service_orders`
SET `status` = 'awaiting_intake'
WHERE `status` IN ('paid', 'awaiting_acceptance')
  AND `intakeSubmittedAt` IS NULL
  AND `acceptedAt` IS NULL;

CREATE TABLE IF NOT EXISTS `service_order_attachments` (
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

CREATE TABLE IF NOT EXISTS `service_order_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `firmId` int NOT NULL,
  `type` enum(
    'intake_submitted',
    'assigned',
    'delivered',
    'revision_requested',
    'completed',
    'remark',
    'locked',
    'system'
  ) NOT NULL,
  `body` text,
  `authorUserId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `service_order_events_id` PRIMARY KEY(`id`)
);
