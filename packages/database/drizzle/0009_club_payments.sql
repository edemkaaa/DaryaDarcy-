CREATE TABLE IF NOT EXISTS `club_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`email` varchar(320),
	`sum` varchar(32),
	`status` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `club_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `club_payments_orderId` UNIQUE(`orderId`)
);
