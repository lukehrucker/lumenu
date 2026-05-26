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

export { Keylight } from './keylight.js'
export type { KeylightOperationError } from './keylight.js'
export { Temperature } from './temperature.js'
export {
  KeylightError,
  KeylightConnectionError,
  KeylightBadRequestError,
  KeylightValidationError,
} from './errors.js'
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
