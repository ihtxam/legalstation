ALTER TABLE `payment_plans` ADD `autoGenerateInvoices` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_installments` ADD `generatedInvoiceId` int;