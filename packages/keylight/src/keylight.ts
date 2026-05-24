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
import type { HttpClient, HttpResponse } from './http-client.js'
import { FetchHttpClient } from './http-client.js'

export type KeylightOperationError =
  | KeylightConnectionError
  | KeylightBadRequestError
  | KeylightValidationError

export interface KeylightOptions {
  httpClient?: HttpClient
}

/**
 * Temperature conversion utilities
 */
export class Temperature {
  /**
   * Convert Kelvin to Keylight API format
   * Formula: temperature = (1000000 / kelvin) - 10
   * @param kelvin Temperature in Kelvin (2900-7000)
   * @returns Temperature in API format (143-344)
   */
  static kelvinToApi(kelvin: number): number {
    if (kelvin < 2900 || kelvin > 7000) {
      throw new KeylightValidationError('kelvin', kelvin, 2900, 7000)
    }
    return Math.round(1000000 / kelvin - 10)
  }

  /**
   * Convert Keylight API format to Kelvin
   * Formula: kelvin = 1000000 / (temperature + 10)
   * @param temperature Temperature in API format (143-344)
   * @returns Temperature in Kelvin (2900-7000)
   */
  static apiToKelvin(temperature: number): number {
    if (temperature < 143 || temperature > 344) {
      throw new KeylightValidationError('temperature', temperature, 143, 344)
    }
    return Math.round(1000000 / (temperature + 10))
  }
}

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
  private readonly httpClient: HttpClient

  /**
   * Create a new Keylight client
   * @param ip IP address of the Keylight device
   * @param httpClient Optional HTTP client for testing (defaults to FetchHttpClient)
   */
  constructor(ip: string, httpClient?: HttpClient) {
    this.baseUrl = `http://${ip}:9123/elgato`
    this.httpClient = httpClient ?? new FetchHttpClient()
  }

  /**
   * Create a new Keylight client
   * @param host IP address or hostname of the Keylight device
   * @param options Optional client configuration
   */
  static make(host: string, options: KeylightOptions = {}): Keylight {
    return new Keylight(host, options.httpClient)
  }

  /**
   * Flash the light to identify the device
   */
  identify(): Effect.Effect<void, KeylightOperationError> {
    return this.request('POST', '/identify', () =>
      this.httpClient.post<void>(`${this.baseUrl}/identify`)
    ).pipe(Effect.asVoid)
  }

  /**
   * Get device accessory information
   */
  getAccessoryInfo(): Effect.Effect<AccessoryInfo, KeylightOperationError> {
    return this.request('GET', '/accessory-info', () =>
      this.httpClient.get<AccessoryInfo>(`${this.baseUrl}/accessory-info`)
    )
  }

  /**
   * Update device accessory information
   * @param info Partial accessory info to update
   */
  updateAccessoryInfo(
    info: AccessoryInfoUpdate
  ): Effect.Effect<AccessoryInfo, KeylightOperationError> {
    return this.request('PUT', '/accessory-info', () =>
      this.httpClient.put<AccessoryInfo>(`${this.baseUrl}/accessory-info`, info)
    )
  }

  /**
   * Get current lights status
   */
  getLights(): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.request('GET', '/lights', () =>
      this.httpClient.get<LightsStatus>(`${this.baseUrl}/lights`)
    )
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
        this.request('PUT', '/lights', () =>
          this.httpClient.put<LightsStatus>(`${this.baseUrl}/lights`, lights)
        )
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
    return this.request('GET', '/lights/settings', () =>
      this.httpClient.get<LightSettings>(`${this.baseUrl}/lights/settings`)
    )
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
        this.request('PUT', '/lights/settings', () =>
          this.httpClient.put<LightSettings>(
            `${this.baseUrl}/lights/settings`,
            settings
          )
        )
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
    _method: string,
    endpoint: string,
    makeRequest: () => Effect.Effect<HttpResponse<T>, KeylightConnectionError>
  ): Effect.Effect<T, KeylightConnectionError | KeylightBadRequestError> {
    return Effect.gen(function* () {
      const response = yield* makeRequest()

      if (!response.ok) {
        return yield* Effect.fail(new KeylightBadRequestError(endpoint))
      }

      return response.data
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
