CREATE TABLE `normal_checkout_requests` (
  `requestKey` varchar(64) NOT NULL,
  `actorUserId` int NOT NULL,
  `requestHash` varchar(64) NOT NULL,
  `orderId` varchar(64) NOT NULL,
  `amountMinor` int NOT NULL,
  `merchantDomain` varchar(255) NOT NULL,
  `checkoutUrlHash` varchar(64) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`requestKey`),
  UNIQUE KEY `normal_checkout_order_unique` (`orderId`)
) ENGINE=InnoDB;
