import type {
  AccessoryInfo,
  AccessoryInfoUpdate,
  LightsStatus,
  LightUpdate,
  LightsUpdate,
  LightSettings,
  LightSettingsUpdate,
} from './types.js'
import { Effect } from 'effect'

import {
  KeylightConnectionError,
  KeylightBadRequestError,
  KeylightValidationError,
} from './errors.js'
import { Temperature } from './temperature.js'

interface HttpResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
}

export type KeylightOperationError =
  | KeylightConnectionError
  | KeylightBadRequestError
  | KeylightValidationError

/**
 * Elgato Key Light client
 *
 * @example
 * ```typescript
 * const keylight = Keylight.make('192.168.1.61')
 * await Effect.runPromise(keylight.setBrightness(50))
 * ```
 */
export class Keylight {
  private readonly baseUrl: string

  /**
   * Create a new Keylight client
   * @param ip IP address of the Keylight device
   */
  constructor(ip: string) {
    this.baseUrl = `http://${ip}:9123/elgato`
  }

  /**
   * Create a new Keylight client
   * @param host IP address or hostname of the Keylight device
   */
  static make(host: string): Keylight {
    return new Keylight(host)
  }

  /**
   * Flash the light to identify the device
   */
  identify(): Effect.Effect<void, KeylightOperationError> {
    return this.request('/identify', {
      method: 'POST',
      expectJson: false,
    }).pipe(Effect.asVoid)
  }

  /**
   * Get device accessory information
   */
  getAccessoryInfo(): Effect.Effect<AccessoryInfo, KeylightOperationError> {
    return this.request('/accessory-info', { method: 'GET' })
  }

  /**
   * Update device accessory information
   * @param info Partial accessory info to update
   */
  updateAccessoryInfo(
    info: AccessoryInfoUpdate
  ): Effect.Effect<AccessoryInfo, KeylightOperationError> {
    return this.request('/accessory-info', {
      method: 'PUT',
      body: info,
    })
  }

  /**
   * Get current lights status
   */
  getLights(): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.request('/lights', { method: 'GET' })
  }

  /**
   * Update lights status
   * @param lights Lights update configuration
   */
  updateLights(
    lights: LightsUpdate
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.validateLights(lights).pipe(
      Effect.flatMap(() =>
        this.request('/lights', {
          method: 'PUT',
          body: lights,
        })
      )
    )
  }

  /**
   * Alias for updating lights status.
   * @param light Light update configuration
   */
  setLights(
    light: LightUpdate
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.updateLights({
      numberOfLights: 1,
      lights: [light],
    })
  }

  /**
   * Get light settings
   */
  getSettings(): Effect.Effect<LightSettings, KeylightOperationError> {
    return this.request('/lights/settings', { method: 'GET' })
  }

  /**
   * Update light settings
   * @param settings Partial settings to update
   */
  updateSettings(
    settings: LightSettingsUpdate
  ): Effect.Effect<LightSettings, KeylightOperationError> {
    return this.validateSettings(settings).pipe(
      Effect.flatMap(() =>
        this.request('/lights/settings', {
          method: 'PUT',
          body: settings,
        })
      )
    )
  }

  /**
   * Turn on the light (preserves current brightness and temperature)
   */
  turnOn(): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights({ on: 1 })
  }

  /**
   * Turn off the light (preserves current brightness and temperature)
   */
  turnOff(): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights({ on: 0 })
  }

  /**
   * Set brightness percentage (0-100)
   * @param brightness Brightness percentage (0-100)
   */
  setBrightness(
    brightness: number
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights({ brightness })
  }

  /**
   * Set temperature in Kelvin (2900-7000)
   * @param kelvin Temperature in Kelvin (2900-7000)
   */
  setTemperatureKelvin(
    kelvin: number
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return Effect.try({
      try: () => Temperature.kelvinToApi(kelvin),
      catch: (error: unknown) => error as KeylightValidationError,
    }).pipe(
      Effect.flatMap((temperature: number) => this.setTemperature(temperature))
    )
  }

  /**
   * Set temperature in API format (143-344)
   * @param temperature Temperature in API format (143-344)
   */
  setTemperature(
    temperature: number
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights({ temperature })
  }

  /**
   * Set multiple properties at once
   * @param options Light properties to set
   */
  setLight(
    options: LightUpdate
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights(options)
  }

  private request<T>(
    endpoint: string,
    options: {
      method: 'GET' | 'PUT' | 'POST'
      body?: unknown
      expectJson?: boolean
    }
  ): Effect.Effect<T, KeylightConnectionError | KeylightBadRequestError> {
    const url = `${this.baseUrl}${endpoint}`

    return Effect.gen(function* () {
      const response = yield* Keylight.fetchJson<T>(url, options)

      if (!response.ok) {
        return yield* Effect.fail(new KeylightBadRequestError(endpoint))
      }

      return response.data
    })
  }

  private static fetchJson<T>(
    url: string,
    options: {
      method: 'GET' | 'PUT' | 'POST'
      body?: unknown
      expectJson?: boolean
    }
  ): Effect.Effect<HttpResponse<T>, KeylightConnectionError> {
    return Effect.tryPromise({
      try: async () => {
        const hasBody = options.body !== undefined
        const response = await fetch(url, {
          method: options.method,
          headers: {
            Accept: 'application/json',
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(hasBody ? { body: JSON.stringify(options.body) } : {}),
        })

        const data =
          response.ok && options.expectJson !== false
            ? ((await response.json()) as T)
            : (null as T)

        return {
          ok: response.ok,
          status: response.status,
          data,
        }
      },
      catch: (cause) => new KeylightConnectionError(url, cause as Error),
    })
  }

  private validateLights(
    lights: LightsUpdate
  ): Effect.Effect<void, KeylightValidationError> {
    for (const light of lights.lights) {
      if (light.brightness !== undefined) {
        const result = this.validateRange(
          'brightness',
          light.brightness,
          0,
          100
        )
        if (result) {
          return Effect.fail(result)
        }
      }

      if (light.temperature !== undefined) {
        const result = this.validateRange(
          'temperature',
          light.temperature,
          143,
          344
        )
        if (result) {
          return Effect.fail(result)
        }
      }
    }

    return Effect.void
  }

  private validateSettings(
    settings: LightSettingsUpdate
  ): Effect.Effect<void, KeylightValidationError> {
    if (settings.powerOnBrightness !== undefined) {
      const result = this.validateRange(
        'powerOnBrightness',
        settings.powerOnBrightness,
        0,
        100
      )
      if (result) {
        return Effect.fail(result)
      }
    }

    if (settings.powerOnTemperature !== undefined) {
      const result = this.validateRange(
        'powerOnTemperature',
        settings.powerOnTemperature,
        143,
        344
      )
      if (result) {
        return Effect.fail(result)
      }
    }

    return Effect.void
  }

  private validateRange(
    field: string,
    value: number,
    min: number,
    max: number
  ): KeylightValidationError | undefined {
    if (value < min || value > max) {
      return new KeylightValidationError(field, value, min, max)
    }
  }
}
