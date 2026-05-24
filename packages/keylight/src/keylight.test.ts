import { describe, expect, test, mock } from 'bun:test'
import { Effect } from 'effect'

import { Keylight, Temperature } from './keylight.js'
import type { HttpResponse } from './http-client.js'
import { HttpClient } from './http-client.js'
import {
  KeylightConnectionError,
  KeylightBadRequestError,
  KeylightValidationError,
} from './errors.js'
import type { AccessoryInfo, LightsStatus, LightSettings } from './types.js'

/**
 * Mock HTTP client for testing
 */
class MockHttpClient implements HttpClient {
  getMock = mock((_url: string) =>
    Promise.resolve({ ok: true, status: 200, data: {} as unknown })
  )
  putMock = mock((_url: string, _body: unknown) =>
    Promise.resolve({ ok: true, status: 200, data: {} as unknown })
  )
  postMock = mock((_url: string, _body?: unknown) =>
    Promise.resolve({ ok: true, status: 200, data: {} as unknown })
  )

  get<T>(url: string): Effect.Effect<HttpResponse<T>, KeylightConnectionError> {
    return Effect.tryPromise({
      try: () => this.getMock(url) as Promise<HttpResponse<T>>,
      catch: (cause) => new KeylightConnectionError(url, cause as Error),
    })
  }

  put<T>(
    url: string,
    body: unknown
  ): Effect.Effect<HttpResponse<T>, KeylightConnectionError> {
    return Effect.tryPromise({
      try: () => this.putMock(url, body) as Promise<HttpResponse<T>>,
      catch: (cause) => new KeylightConnectionError(url, cause as Error),
    })
  }

  post<T>(
    url: string,
    body?: unknown
  ): Effect.Effect<HttpResponse<T>, KeylightConnectionError> {
    return Effect.tryPromise({
      try: () => this.postMock(url, body) as Promise<HttpResponse<T>>,
      catch: (cause) => new KeylightConnectionError(url, cause as Error),
    })
  }

  reset() {
    this.getMock.mockReset()
    this.putMock.mockReset()
    this.postMock.mockReset()
  }
}

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
  let mockClient: MockHttpClient
  let keylight: Keylight

  const run = <A, E>(effect: Effect.Effect<A, E, HttpClient>) =>
    Effect.runPromise(Effect.provideService(effect, HttpClient, mockClient))
  const runError = <A, E>(effect: Effect.Effect<A, E, HttpClient>) =>
    Effect.runPromise(
      Effect.provideService(Effect.flip(effect), HttpClient, mockClient)
    )

  const setup = () => {
    mockClient = new MockHttpClient()
    keylight = new Keylight('192.168.1.61')
  }

  describe('constructor', () => {
    test('creates instance with IP address', () => {
      const kl = new Keylight('192.168.1.61')
      expect(kl).toBeInstanceOf(Keylight)
    })

    test('creates instance with factory', () => {
      const kl = Keylight.make('192.168.1.61')
      expect(kl).toBeInstanceOf(Keylight)
    })
  })

  describe('identify', () => {
    test('calls POST /identify endpoint', async () => {
      setup()
      mockClient.postMock.mockResolvedValue({
        ok: true,
        status: 200,
        data: null as unknown,
      })

      await run(keylight.identify())

      expect(mockClient.postMock).toHaveBeenCalledWith(
        'http://192.168.1.61:9123/elgato/identify',
        undefined
      )
    })

    test('throws KeylightBadRequestError on 400', async () => {
      setup()
      mockClient.postMock.mockResolvedValue({
        ok: false,
        status: 400,
        data: null as unknown,
      })

      await expect(runError(keylight.identify())).resolves.toBeInstanceOf(
        KeylightBadRequestError
      )
    })

    test('throws KeylightConnectionError on network error', async () => {
      setup()
      mockClient.postMock.mockRejectedValue(new Error('Network error'))

      await expect(runError(keylight.identify())).resolves.toBeInstanceOf(
        KeylightConnectionError
      )
    })
  })

  describe('getAccessoryInfo', () => {
    test('returns accessory info', async () => {
      setup()
      const mockInfo: AccessoryInfo = {
        productName: 'Elgato Key Light',
        hardwareBoardType: 53,
        firmwareBuildNumber: 192,
        firmwareVersion: '1.0.3',
        serialNumber: 'XXXXXXXXXXXX',
        displayName: 'My Light',
        features: ['lights'],
      }

      mockClient.getMock.mockResolvedValue({
        ok: true,
        status: 200,
        data: mockInfo,
      })

      const result = await run(keylight.getAccessoryInfo())

      expect(mockClient.getMock).toHaveBeenCalledWith(
        'http://192.168.1.61:9123/elgato/accessory-info'
      )
      expect(result).toEqual(mockInfo)
    })

    test('throws KeylightBadRequestError on 400', async () => {
      setup()
      mockClient.getMock.mockResolvedValue({
        ok: false,
        status: 400,
        data: null as unknown,
      })

      await expect(
        runError(keylight.getAccessoryInfo())
      ).resolves.toBeInstanceOf(KeylightBadRequestError)
    })
  })

  describe('updateAccessoryInfo', () => {
    test('updates accessory info', async () => {
      setup()
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

      mockClient.putMock.mockResolvedValue({
        ok: true,
        status: 200,
        data: mockResponse,
      })

      const result = await run(keylight.updateAccessoryInfo(update))

      expect(mockClient.putMock).toHaveBeenCalledWith(
        'http://192.168.1.61:9123/elgato/accessory-info',
        update
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getLights', () => {
    test('returns lights status', async () => {
      setup()
      const mockStatus: LightsStatus = {
        numberOfLights: 1,
        lights: [
          {
            on: 1,
            brightness: 50,
            temperature: 200,
          },
        ],
      }

      mockClient.getMock.mockResolvedValue({
        ok: true,
        status: 200,
        data: mockStatus,
      })

      const result = await run(keylight.getLights())

      expect(mockClient.getMock).toHaveBeenCalledWith(
        'http://192.168.1.61:9123/elgato/lights'
      )
      expect(result).toEqual(mockStatus)
    })
  })

  describe('updateLights', () => {
    test('updates lights status', async () => {
      setup()
      const update = {
        numberOfLights: 1,
        lights: [{ on: 1 as const, brightness: 75, temperature: 200 }],
      }
      const mockResponse: LightsStatus = {
        numberOfLights: 1,
        lights: [{ on: 1, brightness: 75, temperature: 200 }],
      }

      mockClient.putMock.mockResolvedValue({
        ok: true,
        status: 200,
        data: mockResponse,
      })

      const result = await run(keylight.updateLights(update))

      expect(mockClient.putMock).toHaveBeenCalledWith(
        'http://192.168.1.61:9123/elgato/lights',
        update
      )
      expect(result).toEqual(mockResponse)
    })

    test('validates brightness range', async () => {
      setup()
      const update = {
        numberOfLights: 1,
        lights: [{ brightness: 101 }],
      }

      await expect(
        runError(keylight.updateLights(update))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })

    test('validates temperature range', async () => {
      setup()
      const update = {
        numberOfLights: 1,
        lights: [{ temperature: 400 }],
      }

      await expect(
        runError(keylight.updateLights(update))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })
  })

  describe('getSettings', () => {
    test('returns settings', async () => {
      setup()
      const mockSettings: LightSettings = {
        powerOnBehavior: 1,
        powerOnBrightness: 20,
        powerOnTemperature: 213,
        switchOnDurationMs: 100,
        switchOffDurationMs: 300,
        colorChangeDurationMs: 100,
      }

      mockClient.getMock.mockResolvedValue({
        ok: true,
        status: 200,
        data: mockSettings,
      })

      const result = await run(keylight.getSettings())

      expect(mockClient.getMock).toHaveBeenCalledWith(
        'http://192.168.1.61:9123/elgato/lights/settings'
      )
      expect(result).toEqual(mockSettings)
    })
  })

  describe('updateSettings', () => {
    test('updates settings', async () => {
      setup()
      const update = { powerOnBehavior: 0 as const }
      const mockResponse: LightSettings = {
        powerOnBehavior: 0,
        powerOnBrightness: 20,
        powerOnTemperature: 213,
        switchOnDurationMs: 100,
        switchOffDurationMs: 300,
        colorChangeDurationMs: 100,
      }

      mockClient.putMock.mockResolvedValue({
        ok: true,
        status: 200,
        data: mockResponse,
      })

      const result = await run(keylight.updateSettings(update))

      expect(mockClient.putMock).toHaveBeenCalledWith(
        'http://192.168.1.61:9123/elgato/lights/settings',
        update
      )
      expect(result).toEqual(mockResponse)
    })

    test('validates powerOnBrightness range', async () => {
      setup()
      const update = { powerOnBrightness: 150 }

      await expect(
        runError(keylight.updateSettings(update))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })

    test('validates powerOnTemperature range', async () => {
      setup()
      const update = { powerOnTemperature: 500 }

      await expect(
        runError(keylight.updateSettings(update))
      ).resolves.toBeInstanceOf(KeylightValidationError)
    })
  })

  describe('convenience methods', () => {
    describe('turnOn', () => {
      test('turns on the light', async () => {
        setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 50, temperature: 200 }],
        }

        mockClient.putMock.mockResolvedValue({
          ok: true,
          status: 200,
          data: mockResponse,
        })

        const result = await run(keylight.turnOn())

        expect(mockClient.putMock).toHaveBeenCalledWith(
          'http://192.168.1.61:9123/elgato/lights',
          { numberOfLights: 1, lights: [{ on: 1 }] }
        )
        expect(result).toEqual(mockResponse)
      })
    })

    describe('turnOff', () => {
      test('turns off the light', async () => {
        setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 0, brightness: 50, temperature: 200 }],
        }

        mockClient.putMock.mockResolvedValue({
          ok: true,
          status: 200,
          data: mockResponse,
        })

        const result = await run(keylight.turnOff())

        expect(mockClient.putMock).toHaveBeenCalledWith(
          'http://192.168.1.61:9123/elgato/lights',
          { numberOfLights: 1, lights: [{ on: 0 }] }
        )
        expect(result).toEqual(mockResponse)
      })
    })

    describe('setBrightness', () => {
      test('sets brightness', async () => {
        setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 80, temperature: 200 }],
        }

        mockClient.putMock.mockResolvedValue({
          ok: true,
          status: 200,
          data: mockResponse,
        })

        const result = await run(keylight.setBrightness(80))

        expect(mockClient.putMock).toHaveBeenCalledWith(
          'http://192.168.1.61:9123/elgato/lights',
          { numberOfLights: 1, lights: [{ brightness: 80 }] }
        )
        expect(result).toEqual(mockResponse)
      })

      test('validates brightness range', async () => {
        setup()
        await expect(
          runError(keylight.setBrightness(-5))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        await expect(
          runError(keylight.setBrightness(150))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setTemperatureKelvin', () => {
      test('sets temperature in Kelvin', async () => {
        setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 50, temperature: 240 }],
        }

        mockClient.putMock.mockResolvedValue({
          ok: true,
          status: 200,
          data: mockResponse,
        })

        const result = await run(keylight.setTemperatureKelvin(4000))

        expect(mockClient.putMock).toHaveBeenCalledWith(
          'http://192.168.1.61:9123/elgato/lights',
          { numberOfLights: 1, lights: [{ temperature: 240 }] }
        )
        expect(result).toEqual(mockResponse)
      })

      test('validates Kelvin range', async () => {
        setup()
        await expect(
          runError(keylight.setTemperatureKelvin(2000))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        await expect(
          runError(keylight.setTemperatureKelvin(8000))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setTemperature', () => {
      test('sets temperature in API format', async () => {
        setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 50, temperature: 200 }],
        }

        mockClient.putMock.mockResolvedValue({
          ok: true,
          status: 200,
          data: mockResponse,
        })

        const result = await run(keylight.setTemperature(200))

        expect(mockClient.putMock).toHaveBeenCalledWith(
          'http://192.168.1.61:9123/elgato/lights',
          { numberOfLights: 1, lights: [{ temperature: 200 }] }
        )
        expect(result).toEqual(mockResponse)
      })

      test('validates temperature range', async () => {
        setup()
        await expect(
          runError(keylight.setTemperature(100))
        ).resolves.toBeInstanceOf(KeylightValidationError)
        await expect(
          runError(keylight.setTemperature(500))
        ).resolves.toBeInstanceOf(KeylightValidationError)
      })
    })

    describe('setLight', () => {
      test('sets multiple properties at once', async () => {
        setup()
        const mockResponse: LightsStatus = {
          numberOfLights: 1,
          lights: [{ on: 1, brightness: 75, temperature: 250 }],
        }

        mockClient.putMock.mockResolvedValue({
          ok: true,
          status: 200,
          data: mockResponse,
        })

        const result = await run(
          keylight.setLight({
            on: 1,
            brightness: 75,
            temperature: 250,
          })
        )

        expect(mockClient.putMock).toHaveBeenCalledWith(
          'http://192.168.1.61:9123/elgato/lights',
          {
            numberOfLights: 1,
            lights: [{ on: 1, brightness: 75, temperature: 250 }],
          }
        )
        expect(result).toEqual(mockResponse)
      })
    })
  })
})
