/**
 * @lumenu/keylight - Elgato Key Light API client
 *
 * @example
 * ```typescript
 * import { Effect } from 'effect'
 * import { Keylight } from '@lumenu/keylight'
 *
 * const keylight = Keylight.make('192.168.1.61')
 *
 * // Turn on and set to 50% brightness
 * await Effect.runPromise(keylight.turnOn())
 * await Effect.runPromise(keylight.setBrightness(50))
 *
 * // Set temperature to 4000K
 * await Effect.runPromise(keylight.setTemperatureKelvin(4000))
 *
 * // Get current status
 * const status = await Effect.runPromise(keylight.getLights())
 * console.log(status)
 * ```
 */

export { Keylight, KeylightClient } from './keylight.js'
export type { KeylightOperationError } from './keylight.js'
export { Temperature } from './temperature.js'
export {
  AccessoryInfo as AccessoryInfoSchema,
  AccessoryInfoUpdate as AccessoryInfoUpdateSchema,
  ApiTemperature,
  Brightness,
  KelvinTemperature,
  Light as LightSchema,
  LightSettings as LightSettingsSchema,
  LightSettingsUpdate as LightSettingsUpdateSchema,
  LightsStatus as LightsStatusSchema,
  LightsUpdate as LightsUpdateSchema,
  LightUpdate as LightUpdateSchema,
  PowerState,
  PowerOnBehavior,
} from './schemas.js'
export {
  KeylightError,
  KeylightConnectionError,
  KeylightHttpError,
  KeylightBadRequestError,
  KeylightDecodeError,
  KeylightValidationError,
} from './errors.js'
export { makeKeylightService } from './transport.js'
export type {
  KeylightService,
  KeylightTransportError,
  KeylightTransportOptions,
} from './transport.js'
export type {
  AccessoryInfo,
  AccessoryInfoUpdate,
  Light,
  LightsStatus,
  LightUpdate,
  LightsUpdate,
  LightSettings,
  LightSettingsUpdate,
} from './types.js'
