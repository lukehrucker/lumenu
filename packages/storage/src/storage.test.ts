import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { LumenuStorage, Storage } from './storage.js'

let storage: LumenuStorage

describe('LumenuStorage', () => {
  beforeEach(async () => {
    storage = await Effect.runPromise(LumenuStorage.make({ path: ':memory:' }))
  })

  afterEach(async () => {
    await Effect.runPromise(storage.close())
  })

  test('starts with no devices', async () => {
    await expect(Effect.runPromise(storage.listDevices())).resolves.toEqual([])
  })

  test('upserts and lists devices', async () => {
    const saved = await Effect.runPromise(
      storage.upsertDevice({
        serialNumber: 'ABC123',
        host: '192.168.1.10',
        displayName: 'Key Light Left',
        productName: 'Elgato Key Light',
        firmwareVersion: '1.0.3',
        firmwareBuildNumber: 192,
        lastOn: 1,
        lastBrightness: 50,
        lastTemperature: 240,
        lastSeenAt: '2026-05-24T12:00:00.000Z',
      })
    )

    expect(saved.serialNumber).toBe('ABC123')
    expect(saved.displayName).toBe('Key Light Left')
    expect(saved.lastBrightness).toBe(50)

    const devices = await Effect.runPromise(storage.listDevices())
    expect(devices).toHaveLength(1)
    expect(devices[0]?.serialNumber).toBe('ABC123')
  })

  test('updates existing device by serial number', async () => {
    const original = await Effect.runPromise(
      storage.upsertDevice({
        serialNumber: 'ABC123',
        host: '192.168.1.10',
        displayName: 'Key Light Left',
        lastBrightness: 50,
      })
    )

    const updated = await Effect.runPromise(
      storage.upsertDevice({
        serialNumber: 'ABC123',
        host: '192.168.1.11',
        displayName: 'Key Light Renamed',
      })
    )

    expect(updated.id).toBe(original.id)
    expect(updated.host).toBe('192.168.1.11')
    expect(updated.displayName).toBe('Key Light Renamed')
    expect(updated.lastBrightness).toBe(50)

    const devices = await Effect.runPromise(storage.listDevices())
    expect(devices).toHaveLength(1)
  })

  test('updates cached device state', async () => {
    await Effect.runPromise(
      storage.upsertDevice({
        serialNumber: 'ABC123',
        host: '192.168.1.10',
        displayName: 'Key Light Left',
      })
    )

    const updated = await Effect.runPromise(
      storage.updateDeviceState('ABC123', {
        lastOn: 0,
        lastBrightness: 15,
        lastTemperature: 300,
        lastSeenAt: '2026-05-24T12:01:00.000Z',
      })
    )

    expect(updated?.lastOn).toBe(0)
    expect(updated?.lastBrightness).toBe(15)
    expect(updated?.lastTemperature).toBe(300)
  })

  test('deletes devices', async () => {
    await Effect.runPromise(
      storage.upsertDevice({
        serialNumber: 'ABC123',
        host: '192.168.1.10',
        displayName: 'Key Light Left',
      })
    )

    await Effect.runPromise(storage.deleteDevice('ABC123'))

    await expect(
      Effect.runPromise(storage.getDevice('ABC123'))
    ).resolves.toBeUndefined()
  })

  test('provides storage as an Effect service', async () => {
    const program = Storage.pipe(
      Effect.flatMap((storage) =>
        storage.upsertDevice({
          serialNumber: 'ABC123',
          host: '192.168.1.10',
          displayName: 'Key Light Left',
        })
      ),
      Effect.flatMap(() => Storage),
      Effect.flatMap((storage) => storage.listDevices())
    )

    const devices = await Effect.runPromise(
      program.pipe(Effect.provide(Storage.layer({ path: ':memory:' })))
    )

    expect(devices).toHaveLength(1)
    expect(devices[0]?.serialNumber).toBe('ABC123')
  })
})
