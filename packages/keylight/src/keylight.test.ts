import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'bun:test'
import { Effect } from 'effect'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Keylight, Temperature } from './keylight.js'
import {
  KeylightConnectionError,
  KeylightBadRequestError,
  KeylightValidationError,
} from './errors.js'
import type { AccessoryInfo, LightsStatus, LightSettings } from './types.js'

const baseUrl = 'http://192.168.1.61:9123/elgato'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

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
  const setup = () => new Keylight('192.168.1.61')

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
      const keylight = setup()
      let called = false

      server.use(
        http.post(`${baseUrl}/identify`, () => {
          called = true
          return new HttpResponse(null)
        })
      )

      await Effect.runPromise(keylight.identify())

      expect(called).toBe(true)
    })

    test('throws KeylightBadRequestError on 400', async () => {
      const keylight = setup()

      server.use(
        http.post(
          `${baseUrl}/identify`,
          () => new HttpResponse(null, { status: 400 })
        )
      )

      await expect(
        Effect.runPromise(Effect.flip(keylight.identify()))
      ).resolves.toBeInstanceOf(KeylightBadRequestError)
    })

    test('throws KeylightConnectionError on network error', async () => {
      const keylight = setup()

      server.use(http.post(`${baseUrl}/identify`, () => HttpResponse.error()))

      await expect(
        Effect.runPromise(Effect.flip(keylight.identify()))
      ).resolves.toBeInstanceOf(KeylightConnectionError)
    })
  })

  describe('getAccessoryInfo', () => {
    test('returns accessory info', async () => {
      const keylight = setup()
      const mockInfo: AccessoryInfo = {
        productName: 'Elgato Key Light',
        hardwareBoardType: 53,
        firmwareBuildNumber: 192,
        firmwareVersion: '1.0.3',
        serialNumber: 'XXXXXXXXXXXX',
        displayName: 'My Light',
        features: ['lights'],
      }

      server.use(
        http.get(`${baseUrl}/accessory-info`, () => HttpResponse.json(mockInfo))
      )

      const result = await Effect.runPromise(keylight.getAccessoryInfo())

      expect(result).toEqual(mockInfo)
    })

    test('throws KeylightBadRequestError on 400', async () => {
      const keylight = setup()

      server.use(
        http.get(
          `${baseUrl}/accessory-info`,
          () => new HttpResponse(null, { status: 400 })
        )
      )

      await expect(
        Effect.runPromise(Effect.flip(keylight.getAccessoryInfo()))
      ).resolves.toBeInstanceOf(KeylightBadRequestError)
    })
  })

  describe('updateAccessoryInfo', () => {
    test('updates accessory info', async () => {
      const keylight = setup()
      const update = { displayName: 'New Name' }
      const mockResponse: AccessoryInfo = {
        productName: 'Elgato Key Light',
        hardwareBoardType: 53,
        firmwareBuildNumber: 192,
        firmwareVersion: '1.0.3',
        serialNumber: 'XXXXXXXXXXXX',
        displayName: 'New Name',
        features: ['lights'],
      }

      server.use(
        http.put(`${baseUrl}/accessory-info`, async ({ request }) => {
          expect(await request.json()).toEqual(update)
          return HttpResponse.json(mockResponse)
        })
      )

      const result = await Effect.runPromise(
        keylight.updateAccessoryInfo(update)
      )

      expect(result).toEqual(mockResponse)
    })
  })

  describe('getLights', () => {
    test('returns lights status', async () => {
      const keylight = setup()
      const mockStatus: LightsStatus = {
        numberOfLights: 1,
        lights: [{ on: 1, brightness: 50, temperature: 200 }],
      }

      server.use(
        http.get(`${baseUrl}/lights`, () => HttpResponse.json(mockStatus))
      )

      const result = await Effect.runPromise(keylight.getLights())

      expect(result).toEqual(mockStatus)
    })
  })

  describe('updateLights', () => {
    test('updates lights status', async () => {
      const keylight = setup()
      const update = {
        numberOfLights: 1,
        lights: [{ on: 1 as const, brightness: 75, temperature: 200 }],
      }
      const mockResponse: LightsStatus = {
        numberOfLights: 1,
        lights: [{ on: 1, brightness: 75, temperature: 200 }],
      }

      server.use(
        http.put(`${baseUrl}/lights`, async ({ request }) => {
          expect(await request.json()).toEqual(update)
          return HttpResponse.json(mockResponse)
        })
      )

      const result = await Effect.runPromise(keylight.updateLights(update))

      expect(result).toEqual(mockResponse)
    })

    test('validates brightness range', async () => {
      const keylight = setup()
      const update = {
        numberOfLights: 1,
        lights: [{ brightness: 101 }],
      }

      await expect(
        Effect.runPromise(Effect.flip(keylight.updateLights(update)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })

    test('validates temperature range', async () => {
      const keylight = setup()
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
      const keylight = setup()
      const mockSettings: LightSettings = {
        powerOnBehavior: 1,
        powerOnBrightness: 20,
        powerOnTemperature: 213,
        switchOnDurationMs: 100,
        switchOffDurationMs: 300,
        colorChangeDurationMs: 100,
      }

      server.use(
        http.get(`${baseUrl}/lights/settings`, () =>
          HttpResponse.json(mockSettings)
        )
      )

      const result = await Effect.runPromise(keylight.getSettings())

      expect(result).toEqual(mockSettings)
    })
  })

  describe('updateSettings', () => {
    test('updates settings', async () => {
      const keylight = setup()
      const update = { powerOnBehavior: 0 as const }
      const mockResponse: LightSettings = {
        powerOnBehavior: 0,
        powerOnBrightness: 20,
        powerOnTemperature: 213,
        switchOnDurationMs: 100,
        switchOffDurationMs: 300,
        colorChangeDurationMs: 100,
      }

      server.use(
        http.put(`${baseUrl}/lights/settings`, async ({ request }) => {
          expect(await request.json()).toEqual(update)
          return HttpResponse.json(mockResponse)
        })
      )

      const result = await Effect.runPromise(keylight.updateSettings(update))

      expect(result).toEqual(mockResponse)
    })

    test('validates powerOnBrightness range', async () => {
      const keylight = setup()
      const update = { powerOnBrightness: 150 }

      await expect(
        Effect.runPromise(Effect.flip(keylight.updateSettings(update)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })

    test('validates powerOnTemperature range', async () => {
      const keylight = setup()
      const update = { powerOnTemperature: 500 }

      await expect(
        Effect.runPromise(Effect.flip(keylight.updateSettings(update)))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })
  })

  describe('convenience methods', () => {
    describe('turnOn', () => {
      test('turns on the light', async () => {
        const keylight = setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 50, temperature: 200 }],
        }

        server.use(
          http.put(`${baseUrl}/lights`, async ({ request }) => {
            expect(await request.json()).toEqual({
              numberOfLights: 1,
              lights: [{ on: 1 }],
            })
            return HttpResponse.json(mockResponse)
          })
        )

        const result = await Effect.runPromise(keylight.turnOn())

        expect(result).toEqual(mockResponse)
      })
    })

    describe('turnOff', () => {
      test('turns off the light', async () => {
        const keylight = setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 0, brightness: 50, temperature: 200 }],
        }

        server.use(
          http.put(`${baseUrl}/lights`, async ({ request }) => {
            expect(await request.json()).toEqual({
              numberOfLights: 1,
              lights: [{ on: 0 }],
            })
            return HttpResponse.json(mockResponse)
          })
        )

        const result = await Effect.runPromise(keylight.turnOff())

        expect(result).toEqual(mockResponse)
      })
    })

    describe('setBrightness', () => {
      test('sets brightness', async () => {
        const keylight = setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 80, temperature: 200 }],
        }

        server.use(
          http.put(`${baseUrl}/lights`, async ({ request }) => {
            expect(await request.json()).toEqual({
              numberOfLights: 1,
              lights: [{ brightness: 80 }],
            })
            return HttpResponse.json(mockResponse)
          })
        )

        const result = await Effect.runPromise(keylight.setBrightness(80))

        expect(result).toEqual(mockResponse)
      })

      test('validates brightness range', async () => {
        const keylight = setup()

        await expect(
          Effect.runPromise(Effect.flip(keylight.setBrightness(-5)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        await expect(
          Effect.runPromise(Effect.flip(keylight.setBrightness(150)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setTemperatureKelvin', () => {
      test('sets temperature in Kelvin', async () => {
        const keylight = setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 50, temperature: 240 }],
        }

        server.use(
          http.put(`${baseUrl}/lights`, async ({ request }) => {
            expect(await request.json()).toEqual({
              numberOfLights: 1,
              lights: [{ temperature: 240 }],
            })
            return HttpResponse.json(mockResponse)
          })
        )

        const result = await Effect.runPromise(
          keylight.setTemperatureKelvin(4000)
        )

        expect(result).toEqual(mockResponse)
      })

      test('validates Kelvin range', async () => {
        const keylight = setup()

        await expect(
          Effect.runPromise(Effect.flip(keylight.setTemperatureKelvin(2000)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        await expect(
          Effect.runPromise(Effect.flip(keylight.setTemperatureKelvin(8000)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setTemperature', () => {
      test('sets temperature in API format', async () => {
        const keylight = setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 50, temperature: 200 }],
        }

        server.use(
          http.put(`${baseUrl}/lights`, async ({ request }) => {
            expect(await request.json()).toEqual({
              numberOfLights: 1,
              lights: [{ temperature: 200 }],
            })
            return HttpResponse.json(mockResponse)
          })
        )

        const result = await Effect.runPromise(keylight.setTemperature(200))

        expect(result).toEqual(mockResponse)
      })

      test('validates temperature range', async () => {
        const keylight = setup()

        await expect(
          Effect.runPromise(Effect.flip(keylight.setTemperature(100)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        await expect(
          Effect.runPromise(Effect.flip(keylight.setTemperature(500)))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setLight', () => {
      test('sets multiple properties at once', async () => {
        const keylight = setup()
        const update = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 75, temperature: 250 }],
        }
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 75, temperature: 250 }],
        }

        server.use(
          http.put(`${baseUrl}/lights`, async ({ request }) => {
            expect(await request.json()).toEqual(update)
            return HttpResponse.json(mockResponse)
          })
        )

        const result = await Effect.runPromise(
          keylight.setLight({
            on: 1,
            brightness: 75,
            temperature: 250,
          })
        )

        expect(result).toEqual(mockResponse)
      })
    })
  })
})
