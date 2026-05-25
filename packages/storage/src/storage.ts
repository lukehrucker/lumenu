import { fileURLToPath } from 'node:url'
import { Database } from 'bun:sqlite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Context, Data, Effect, Layer } from 'effect'

import { getDatabasePath } from './path.js'
import { devices, type DeviceRow } from './schema.js'

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

export class StorageError extends Data.TaggedError('StorageError')<{
  readonly cause: unknown
}> {}

export interface DeviceInput {
  serialNumber: string
  host: string
  displayName: string
  productName?: string | null
  firmwareVersion?: string | null
  firmwareBuildNumber?: number | null
  lastOn?: 0 | 1 | null
  lastBrightness?: number | null
  lastTemperature?: number | null
  lastSeenAt?: string | null
}

export interface DeviceStateInput {
  lastOn?: 0 | 1 | null
  lastBrightness?: number | null
  lastTemperature?: number | null
  lastSeenAt?: string | null
}

export interface StorageOptions {
  path?: string
}

export interface StorageService {
  readonly listDevices: () => Effect.Effect<DeviceRow[], StorageError>
  readonly getDevice: (
    serialNumber: string
  ) => Effect.Effect<DeviceRow | undefined, StorageError>
  readonly upsertDevice: (
    device: DeviceInput
  ) => Effect.Effect<DeviceRow, StorageError>
  readonly updateDeviceState: (
    serialNumber: string,
    state: DeviceStateInput
  ) => Effect.Effect<DeviceRow | undefined, StorageError>
  readonly deleteDevice: (
    serialNumber: string
  ) => Effect.Effect<void, StorageError>
}

export class Storage extends Context.Tag('@lumenu/storage/Storage')<
  Storage,
  StorageService
>() {
  static readonly layer = (options?: StorageOptions) =>
    Layer.scoped(
      Storage,
      Effect.acquireRelease(LumenuStorage.make(options), (storage) =>
        storage.close().pipe(Effect.orDie)
      )
    )
}

export class LumenuStorage {
  private readonly sqlite: Database
  private readonly db: ReturnType<typeof drizzle>

  static make(
    options?: StorageOptions
  ): Effect.Effect<LumenuStorage, StorageError> {
    return Effect.try({
      try: () => new LumenuStorage(options),
      catch: (cause) => new StorageError({ cause }),
    })
  }

  constructor(options: StorageOptions = {}) {
    this.sqlite = new Database(options.path ?? getDatabasePath())
    this.db = drizzle(this.sqlite)
    migrate(this.db, { migrationsFolder })
  }

  close(): Effect.Effect<void, StorageError> {
    return this.run(() => {
      this.sqlite.close()
    })
  }

  listDevices(): Effect.Effect<DeviceRow[], StorageError> {
    return this.run(() =>
      this.db.select().from(devices).orderBy(devices.displayName).all()
    )
  }

  getDevice(
    serialNumber: string
  ): Effect.Effect<DeviceRow | undefined, StorageError> {
    return this.run(() => this.getDeviceSync(serialNumber))
  }

  upsertDevice(device: DeviceInput): Effect.Effect<DeviceRow, StorageError> {
    return this.run(() => {
      const now = new Date().toISOString()
      const existing = this.getDeviceSync(device.serialNumber)

      if (existing) {
        this.db
          .update(devices)
          .set({
            host: device.host,
            displayName: device.displayName,
            productName: device.productName ?? null,
            firmwareVersion: device.firmwareVersion ?? null,
            firmwareBuildNumber: device.firmwareBuildNumber ?? null,
            lastOn: device.lastOn ?? existing.lastOn,
            lastBrightness: device.lastBrightness ?? existing.lastBrightness,
            lastTemperature: device.lastTemperature ?? existing.lastTemperature,
            lastSeenAt: device.lastSeenAt ?? existing.lastSeenAt,
            updatedAt: now,
          })
          .where(eq(devices.serialNumber, device.serialNumber))
          .run()
      } else {
        this.db
          .insert(devices)
          .values({
            id: crypto.randomUUID(),
            serialNumber: device.serialNumber,
            host: device.host,
            displayName: device.displayName,
            productName: device.productName ?? null,
            firmwareVersion: device.firmwareVersion ?? null,
            firmwareBuildNumber: device.firmwareBuildNumber ?? null,
            lastOn: device.lastOn ?? null,
            lastBrightness: device.lastBrightness ?? null,
            lastTemperature: device.lastTemperature ?? null,
            lastSeenAt: device.lastSeenAt ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }

      const saved = this.getDeviceSync(device.serialNumber)
      if (!saved) {
        throw new Error(`Failed to save device ${device.serialNumber}`)
      }
      return saved
    })
  }

  updateDeviceState(
    serialNumber: string,
    state: DeviceStateInput
  ): Effect.Effect<DeviceRow | undefined, StorageError> {
    return this.run(() => {
      this.db
        .update(devices)
        .set({
          ...state,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(devices.serialNumber, serialNumber))
        .run()

      return this.getDeviceSync(serialNumber)
    })
  }

  deleteDevice(serialNumber: string): Effect.Effect<void, StorageError> {
    return this.run(() => {
      this.db
        .delete(devices)
        .where(eq(devices.serialNumber, serialNumber))
        .run()
    })
  }

  private getDeviceSync(serialNumber: string): DeviceRow | undefined {
    return this.db
      .select()
      .from(devices)
      .where(eq(devices.serialNumber, serialNumber))
      .get()
  }

  private run<A>(fn: () => A): Effect.Effect<A, StorageError> {
    return Effect.try({
      try: fn,
      catch: (cause) => new StorageError({ cause }),
    })
  }
}
