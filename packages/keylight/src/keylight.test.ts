import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { Keylight, Temperature } from './keylight.js'
import {
  KeylightConnectionError,
  KeylightBadRequestError,
  KeylightValidationError,
} from './errors.js'
import { setupKeylight, setupKeylightMockServer } from './test/keylight-msw.js'
import type { LightSettings } from './types.js'

setupKeylightMockServer()

describe('Temperature', () => {
  describe('kelvinToApi', () => {
    test('converts 4000K correctly', () => {
      expect(Temperature.kelvinToApi(4000)).toBe(240)
    })

    test('converts 2900K correctly (warmest)', () => {
      expect(Temperature.kelvinToApi(2900)).toBe(335)
    })

    test('converts 7000K correctly (coolest)', () => {
      expect(Temperature.kelvinToApi(7000)).toBe(133)
    })

    test('throws error for value below range', () => {
      expect(() => Temperature.kelvinToApi(2800)).toThrow(
        KeylightValidationError
      )
    })

    test('throws error for value above range', () => {
      expect(() => Temperature.kelvinToApi(7100)).toThrow(
        KeylightValidationError
      )
    })
  })

  describe('apiToKelvin', () => {
    test('converts 240 correctly', () => {
      expect(Temperature.apiToKelvin(240)).toBe(4000)
    })

    test('converts 335 correctly (warmest)', () => {
      expect(Temperature.apiToKelvin(335)).toBe(2899)
    })

    test('converts 143 correctly (coolest)', () => {
      expect(Temperature.apiToKelvin(143)).toBe(6536)
    })

    test('throws error for value below range', () => {
      expect(() => Temperature.apiToKelvin(142)).toThrow(
        KeylightValidationError
      )
    })

    test('throws error for value above range', () => {
      expect(() => Temperature.apiToKelvin(345)).toThrow(
        KeylightValidationError
      )
    })
  })

  describe('round-trip conversion', () => {
    test('kelvin -> api -> kelvin is consistent', () => {
      const original = 4000
      const api = Temperature.kelvinToApi(original)
      const result = Temperature.apiToKelvin(api)
      expect(result).toBe(original)
    })
  })
})

describe('Keylight', () => {
  describe('constructor', () => {
    test('creates instance with IP address', () => {
      const keylight = new Keylight('192.168.1.61')
      expect(keylight).toBeInstanceOf(Keylight)
    })

    test('creates instance with factory', () => {
      const keylight = Keylight.make('192.168.1.61')
      expect(keylight).toBeInstanceOf(Keylight)
    })
  })

  describe('identify', () => {
    test('calls POST /identify endpoint', async () => {
      const { device, keylight } = setupKeylight()

      await Effect.runPromise(keylight.identify())

      expect(device.requests).toContainEqual(
        expect.objectContaining({
          method: 'POST',
          pathname: '/elgato/identify',
        })
      )
    })

    test('throws KeylightBadRequestError on 400', async () => {
      const { device, keylight } = setupKeylight()
      device.useBadRequest('POST', '/identify')

      expect(
        Effect.runPromise(Effect.flip(keylight.identify()))
      ).resolves.toBeInstanceOf(KeylightBadRequestError)
    })

    test('throws KeylightConnectionError on network error', async () => {
      const { device, keylight } = setupKeylight()
      device.useNetworkError('POST', '/identify')

      await expect(
        Effect.runPromise(Effect.flip(keylight.identify()))
      ).resolves.toBeInstanceOf(KeylightConnectionError)
    })
  })

  describe('getAccessoryInfo', () => {
    test('returns accessory info', async () => {
      const accessoryInfo = {
        productName: 'Elgato Key Light',
        hardwareBoardType: 53,
        firmwareBuildNumber: 192,
        firmwareVersion: '1.0.3',
        serialNumber: 'XXXXXXXXXXXX',
        displayName: 'My Light',
        features: ['lights'],
      }
      const { keylight } = setupKeylight({ accessoryInfo })

      const result = await Effect.runPromise(keylight.getAccessoryInfo())

      expect(result).toEqual(accessoryInfo)
    })

    test('throws KeylightBadRequestError on 400', async () => {
      const { device, keylight } = setupKeylight()
      device.useBadRequest('GET', '/accessory-info')

      await expect(
        Effect.runPromise(Effect.flip(keylight.getAccessoryInfo()))
      ).resolves.toBeInstanceOf(KeylightBadRequestError)
    })
  })

  describe('updateAccessoryInfo', () => {
    test('updates accessory info', async () => {
      const { device, keylight } = setupKeylight()
      const update = { displayName: 'New Name' }

      const result = await Effect.runPromise(
        keylight.updateAccessoryInfo(update)
      )

      expect(result).toEqual(device.getState().accessoryInfo)
      expect(result.displayName).toBe('New Name')
      expect(device.requests.at(-1)).toMatchObject({
        method: 'PUT',
        pathname: '/elgato/accessory-info',
        body: update,
      })
    })
  })

  describe('getLights', () => {
    test('returns lights status', async () => {
      const lights = {
        numberOfLights: 1,
        lights: [{ on: 1 as const, brightness: 50, temperature: 200 }],
      }
      const { keylight } = setupKeylight({ lights })

      const result = await Effect.runPromise(keylight.getLights())

      expect(result).toEqual(lights)
    })
  })

  describe('updateLights', () => {
    test('updates lights status', async () => {
      const { device, keylight } = setupKeylight()
      const update = {
        numberOfLights: 1,
        lights: [{ on: 1 as const, brightness: 75, temperature: 200 }],
      }

      const result = await Effect.runPromise(keylight.updateLights(update))

      expect(result).toEqual(device.getState().lights)
      expect(device.requests.at(-1)).toMatchObject({
        method: 'PUT',
        pathname: '/elgato/lights',
        body: update,
      })
    })

    test('validates brightness range', async () => {
      const { keylight } = setupKeylight()
      const update = {
        numberOfLights: 1,
        lights: [{ brightness: 101 }],
      }

      await expect(
        Effect.runPromise(Effect.flip(keylight.updateLights(update)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })

    test('validates temperature range', async () => {
      const { keylight } = setupKeylight()
      const update = {
        numberOfLights: 1,
        lights: [{ temperature: 400 }],
      }

      await expect(
        Effect.runPromise(Effect.flip(keylight.updateLights(update)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })
  })

  describe('getSettings', () => {
    test('returns settings', async () => {
      const settings: LightSettings = {
        powerOnBehavior: 1,
        powerOnBrightness: 20,
        powerOnTemperature: 213,
        switchOnDurationMs: 100,
        switchOffDurationMs: 300,
        colorChangeDurationMs: 100,
      }

      const { keylight } = setupKeylight({ settings })
      const result = await Effect.runPromise(keylight.getSettings())
      expect(result).toEqual(settings)
    })
  })

  describe('updateSettings', () => {
    test('updates settings', async () => {
      const { device, keylight } = setupKeylight()
      const update: Partial<LightSettings> = { powerOnBehavior: 0 }

      const result = await Effect.runPromise(keylight.updateSettings(update))

      expect(result).toEqual(device.getState().settings)
      expect(result.powerOnBehavior).toBe(0)
      expect(device.requests.at(-1)).toMatchObject({
        method: 'PUT',
        pathname: '/elgato/lights/settings',
        body: update,
      })
    })

    test('validates powerOnBrightness range', async () => {
      const { keylight } = setupKeylight()

      expect(
        Effect.runPromise(
          Effect.flip(keylight.updateSettings({ powerOnBrightness: 150 }))
        )
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })

    test('validates powerOnTemperature range', async () => {
      const { keylight } = setupKeylight()

      expect(
        Effect.runPromise(
          Effect.flip(keylight.updateSettings({ powerOnTemperature: 500 }))
        )
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })
  })

  describe('convenience methods', () => {
    describe('turnOn', () => {
      test('turns on the light', async () => {
        const { device, keylight } = setupKeylight({
          lights: {
            numberOfLights: 1,
            lights: [{ on: 0, brightness: 50, temperature: 200 }],
          },
        })

        const result = await Effect.runPromise(keylight.turnOn())

        expect(result).toEqual({
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 50, temperature: 200 }],
        })
        expect(device.requests.at(-1)).toMatchObject({
          method: 'PUT',
          pathname: '/elgato/lights',
          body: {
            numberOfLights: 1,
            lights: [{ on: 1 }],
          },
        })
      })
    })

    describe('turnOff', () => {
      test('turns off the light', async () => {
        const { device, keylight } = setupKeylight({
          lights: {
            numberOfLights: 1,
            lights: [{ on: 1, brightness: 50, temperature: 200 }],
          },
        })

        const result = await Effect.runPromise(keylight.turnOff())

        expect(result).toEqual({
          numberOfLights: 1,
          lights: [{ on: 0, brightness: 50, temperature: 200 }],
        })
        expect(device.requests.at(-1)).toMatchObject({
          method: 'PUT',
          pathname: '/elgato/lights',
          body: {
            numberOfLights: 1,
            lights: [{ on: 0 }],
          },
        })
      })
    })

    describe('setBrightness', () => {
      test('sets brightness', async () => {
        const { device, keylight } = setupKeylight()

        const result = await Effect.runPromise(keylight.setBrightness(80))

        expect(result.lights[0]?.brightness).toBe(80)
        expect(device.requests.at(-1)).toMatchObject({
          method: 'PUT',
          pathname: '/elgato/lights',
          body: {
            numberOfLights: 1,
            lights: [{ brightness: 80 }],
          },
        })
      })

      test('validates brightness range', async () => {
        const { keylight } = setupKeylight()

        expect(
          Effect.runPromise(Effect.flip(keylight.setBrightness(-5)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        expect(
          Effect.runPromise(Effect.flip(keylight.setBrightness(150)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setTemperatureKelvin', () => {
      test('sets temperature in Kelvin', async () => {
        const { device, keylight } = setupKeylight()

        const result = await Effect.runPromise(
          keylight.setTemperatureKelvin(4000)
        )

        expect(result.lights[0]?.temperature).toBe(240)
        expect(device.requests.at(-1)).toMatchObject({
          method: 'PUT',
          pathname: '/elgato/lights',
          body: {
            numberOfLights: 1,
            lights: [{ temperature: 240 }],
          },
        })
      })

      test('validates Kelvin range', async () => {
        const { keylight } = setupKeylight()

        expect(
          Effect.runPromise(Effect.flip(keylight.setTemperatureKelvin(2000)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        expect(
          Effect.runPromise(Effect.flip(keylight.setTemperatureKelvin(8000)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setTemperature', () => {
      test('sets temperature in API format', async () => {
        const { device, keylight } = setupKeylight()

        const result = await Effect.runPromise(keylight.setTemperature(200))

        expect(result.lights[0]?.temperature).toBe(200)
        expect(device.requests.at(-1)).toMatchObject({
          method: 'PUT',
          pathname: '/elgato/lights',
          body: {
            numberOfLights: 1,
            lights: [{ temperature: 200 }],
          },
        })
      })

      test('validates temperature range', async () => {
        const { keylight } = setupKeylight()

        expect(
          Effect.runPromise(Effect.flip(keylight.setTemperature(100)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        expect(
          Effect.runPromise(Effect.flip(keylight.setTemperature(500)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setLight', () => {
      test('sets multiple properties at once', async () => {
        const { device, keylight } = setupKeylight()
        const update = {
          numberOfLights: 1,
          lights: [{ on: 1 as const, brightness: 75, temperature: 250 }],
        }

        const result = await Effect.runPromise(
          keylight.setLight({
            on: 1,
            brightness: 75,
            temperature: 250,
          })
        )

        expect(result).toEqual(device.getState().lights)
        expect(device.requests.at(-1)).toMatchObject({
          method: 'PUT',
          pathname: '/elgato/lights',
          body: update,
        })
      })
    })
  })
})
