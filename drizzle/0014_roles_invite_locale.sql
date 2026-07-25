ALTER TABLE `firm_members` MODIFY COLUMN `firmRole` enum('admin','subadmin','lawyer','assistant') NOT NULL DEFAULT 'lawyer';
ALTER TABLE `invitations` MODIFY COLUMN `role` enum('subadmin','lawyer','assistant','client') NOT NULL;
ALTER TABLE `invitations` ADD `emailLanguage` varchar(5) NOT NULL DEFAULT 'en';
