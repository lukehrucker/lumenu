import { Context, Effect, Layer } from 'effect'

import type {
  AccessoryInfo,
  AccessoryInfoUpdate,
  LightSettings,
  LightSettingsUpdate,
  LightsStatus,
  LightsUpdate,
  LightUpdate,
} from './types.js'
import {
  KeylightBadRequestError,
  KeylightConnectionError,
  KeylightDecodeError,
  KeylightHttpError,
  KeylightValidationError,
} from './errors.js'
import { Temperature } from './temperature.js'
import {
  makeKeylightService,
  type KeylightService,
  type KeylightTransportOptions,
} from './transport.js'

export type KeylightOperationError =
  | KeylightConnectionError
  | KeylightHttpError
  | KeylightBadRequestError
  | KeylightDecodeError
  | KeylightValidationError

export class KeylightClient extends Context.Tag('@lumenu/keylight/Client')<
  KeylightClient,
  KeylightService
>() {
  static readonly layer = Layer.succeed(KeylightClient, makeKeylightService())

  static layerWith(
    options: KeylightTransportOptions
  ): Layer.Layer<KeylightClient> {
    return Layer.succeed(KeylightClient, makeKeylightService(options))
  }
}

const defaultService = makeKeylightService()

/**
 * Host-bound Elgato Key Light client.
 *
 * The host-bound class is the ergonomic edge API. Internally it delegates to
 * the same service implementation exposed by `KeylightClient.layer`, so tests
 * and applications can use layers when they want dependency injection.
 *
 * @example
 * ```typescript
 * const keylight = Keylight.make('192.168.1.61')
 * await Effect.runPromise(keylight.setBrightness(50))
 * ```
 */
export class Keylight {
  /**
   * Create a new Keylight client.
   * @param host IP address or hostname of the Keylight device
   */
  constructor(
    readonly host: string,
    private readonly service: KeylightService = defaultService
  ) {}

  /**
   * Create a new Keylight client.
   * @param host IP address or hostname of the Keylight device
   */
  static make(host: string): Keylight {
    return new Keylight(host)
  }

  /**
   * Create a host-bound client from a service implementation.
   * @param host IP address or hostname of the Keylight device
   * @param service Keylight service implementation
   */
  static fromService(host: string, service: KeylightService): Keylight {
    return new Keylight(host, service)
  }

  /**
   * Flash the light to identify the device.
   */
  identify(): Effect.Effect<void, KeylightOperationError> {
    return this.service.identify(this.host)
  }

  /**
   * Get device accessory information.
   */
  getAccessoryInfo(): Effect.Effect<AccessoryInfo, KeylightOperationError> {
    return this.service.getAccessoryInfo(this.host)
  }

  /**
   * Update device accessory information.
   * @param info Partial accessory info to update
   */
  updateAccessoryInfo(
    info: AccessoryInfoUpdate
  ): Effect.Effect<AccessoryInfo, KeylightOperationError> {
    return this.service.updateAccessoryInfo(this.host, info)
  }

  /**
   * Get current lights status.
   */
  getLights(): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.service.getLights(this.host)
  }

  /**
   * Update lights status.
   * @param lights Lights update configuration
   */
  updateLights(
    lights: LightsUpdate
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.service.updateLights(this.host, lights)
  }

  /**
   * Alias for updating the first light.
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
   * Get light settings.
   */
  getSettings(): Effect.Effect<LightSettings, KeylightOperationError> {
    return this.service.getSettings(this.host)
  }

  /**
   * Update light settings.
   * @param settings Partial settings to update
   */
  updateSettings(
    settings: LightSettingsUpdate
  ): Effect.Effect<LightSettings, KeylightOperationError> {
    return this.service.updateSettings(this.host, settings)
  }

  /**
   * Turn on the light while preserving current brightness and temperature.
   */
  turnOn(): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights({ on: true })
  }

  /**
   * Turn off the light while preserving current brightness and temperature.
   */
  turnOff(): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights({ on: false })
  }

  /**
   * Set brightness percentage.
   * @param brightness Brightness percentage (0-100)
   */
  setBrightness(
    brightness: number
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights({ brightness })
  }

  /**
   * Set temperature in Kelvin.
   * @param kelvin Temperature in Kelvin (2900-7000)
   */
  setTemperatureKelvin(
    kelvin: number
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return Temperature.kelvinToApi(kelvin).pipe(
      Effect.flatMap((temperature) => this.setTemperature(temperature))
    )
  }

  /**
   * Set temperature in API format.
   * @param temperature Temperature in API format (143-344)
   */
  setTemperature(
    temperature: number
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights({ temperature })
  }

  /**
   * Set multiple first-light properties at once.
   * @param options Light properties to set
   */
  setLight(
    options: LightUpdate
  ): Effect.Effect<LightsStatus, KeylightOperationError> {
    return this.setLights(options)
  }
}
