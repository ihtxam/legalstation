ALTER TABLE `users` ADD `totpSecret` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `totpEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `preferredLocale` varchar(5) DEFAULT 'en';