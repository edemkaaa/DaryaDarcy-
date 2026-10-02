ALTER TABLE `club_payments`
  ADD COLUMN `cancelAtPeriodEnd` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `cancelledAt` timestamp NULL;

CREATE TABLE IF NOT EXISTS `shop_purchases` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int,
  `productId` varchar(64) NOT NULL,
  `orderId` varchar(80) NOT NULL,
  `email` varchar(320),
  `sum` varchar(32),
  `status` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
  `paidAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `shop_purchases_id` PRIMARY KEY(`id`),
  CONSTRAINT `shop_purchases_orderId` UNIQUE(`orderId`)
);
