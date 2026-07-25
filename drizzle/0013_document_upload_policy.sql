ALTER TABLE `firms` ADD `maxUploadBytes` int NOT NULL DEFAULT 10485760;
ALTER TABLE `firms` ADD `allowedUploadTypes` text;
ALTER TABLE `documents` ADD `description` text;
