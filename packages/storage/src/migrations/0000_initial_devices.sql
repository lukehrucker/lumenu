CREATE TABLE `devices` (
  `id` text PRIMARY KEY NOT NULL,
  `serial_number` text NOT NULL,
  `host` text NOT NULL,
  `display_name` text NOT NULL,
  `product_name` text,
  `firmware_version` text,
  `firmware_build_number` integer,
  `last_on` integer,
  `last_brightness` integer,
  `last_temperature` integer,
  `last_seen_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_serial_number_unique` ON `devices` (`serial_number`);
