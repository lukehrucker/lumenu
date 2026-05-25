import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  serialNumber: text('serial_number').notNull().unique(),
  host: text('host').notNull(),
  displayName: text('display_name').notNull(),
  productName: text('product_name'),
  firmwareVersion: text('firmware_version'),
  firmwareBuildNumber: integer('firmware_build_number'),
  lastOn: integer('last_on'),
  lastBrightness: integer('last_brightness'),
  lastTemperature: integer('last_temperature'),
  lastSeenAt: text('last_seen_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export type DeviceRow = typeof devices.$inferSelect
export type NewDeviceRow = typeof devices.$inferInsert
