import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { KeylightValidationError } from './errors.js'
import { Temperature } from './temperature.js'

describe('Temperature', () => {
  describe('kelvinToApi', () => {
    test('converts 4000K correctly', async () => {
      await expect(
        Effect.runPromise(Temperature.kelvinToApi(4000))
      ).resolves.toBe(240)
    })

    test('converts 2900K correctly (warmest)', async () => {
      await expect(
        Effect.runPromise(Temperature.kelvinToApi(2900))
      ).resolves.toBe(335)
    })

    test('converts 7000K correctly (coolest)', async () => {
      await expect(
        Effect.runPromise(Temperature.kelvinToApi(7000))
      ).resolves.toBe(133)
    })

    test('fails for value below range', async () => {
      await expect(
        Effect.runPromise(Effect.flip(Temperature.kelvinToApi(2800)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })

    test('fails for value above range', async () => {
      await expect(
        Effect.runPromise(Effect.flip(Temperature.kelvinToApi(7100)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })
  })

  describe('apiToKelvin', () => {
    test('converts 240 correctly', async () => {
      await expect(
        Effect.runPromise(Temperature.apiToKelvin(240))
      ).resolves.toBe(4000)
    })

    test('converts 335 correctly (warmest)', async () => {
      await expect(
        Effect.runPromise(Temperature.apiToKelvin(335))
      ).resolves.toBe(2899)
    })

    test('converts 143 correctly (coolest)', async () => {
      await expect(
        Effect.runPromise(Temperature.apiToKelvin(143))
      ).resolves.toBe(6536)
    })

    test('fails for value below range', async () => {
      await expect(
        Effect.runPromise(Effect.flip(Temperature.apiToKelvin(142)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })

    test('fails for value above range', async () => {
      await expect(
        Effect.runPromise(Effect.flip(Temperature.apiToKelvin(345)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })
  })

  describe('round-trip conversion', () => {
    test('kelvin -> api -> kelvin is consistent', async () => {
      const original = 4000
      const api = await Effect.runPromise(Temperature.kelvinToApi(original))
      const result = await Effect.runPromise(Temperature.apiToKelvin(api))
      expect(result).toBe(original)
    })
  })
})
