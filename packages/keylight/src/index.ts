/**
 * @lumenu/keylight - Elgato Key Light API client
 *
 * @example
 * ```typescript
 * import { Effect } from 'effect'
 * import { FetchHttpClient, Keylight } from '@lumenu/keylight'
 * import type { HttpClient } from '@lumenu/keylight'
 *
 * const keylight = Keylight.make('192.168.1.61')
 * const run = <A, E>(effect: Effect.Effect<A, E, HttpClient>) =>
 *   Effect.runPromise(effect.pipe(Effect.provide(FetchHttpClient.layer)))
 *
 * // Turn on and set to 50% brightness
 * await run(keylight.turnOn())
 * await run(keylight.setBrightness(50))
 *
 * // Set temperature to 4000K
 * await run(keylight.setTemperatureKelvin(4000))
 *
 * // Get current status
 * const status = await run(keylight.getLights())
 * console.log(status)
 * ```
 */

export { Keylight, Temperature } from './keylight.js'
export type { KeylightOperationError } from './keylight.js'
export type { HttpResponse } from './http-client.js'
export { HttpClient, FetchHttpClient } from './http-client.js'
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
