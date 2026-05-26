import { Effect, Schema } from 'effect'

import { KeylightValidationError } from './errors.js'
import { ApiTemperature, KelvinTemperature } from './schemas.js'

/**
 * Temperature conversion utilities
 */
export class Temperature {
  /**
   * Convert Kelvin to Keylight API format.
   * Formula: temperature = (1000000 / kelvin) - 10
   * @param kelvin Temperature in Kelvin (2900-7000)
   * @returns Temperature in API format (143-344)
   */
  static kelvinToApi(
    kelvin: number
  ): Effect.Effect<number, KeylightValidationError> {
    return decodeTemperature('kelvin', kelvin, KelvinTemperature).pipe(
      Effect.map((validKelvin) => Math.round(1000000 / validKelvin - 10))
    )
  }

  /**
   * Convert Keylight API format to Kelvin.
   * Formula: kelvin = 1000000 / (temperature + 10)
   * @param temperature Temperature in API format (143-344)
   * @returns Temperature in Kelvin (2900-7000)
   */
  static apiToKelvin(
    temperature: number
  ): Effect.Effect<number, KeylightValidationError> {
    return decodeTemperature('temperature', temperature, ApiTemperature).pipe(
      Effect.map((validTemperature) =>
        Math.round(1000000 / (validTemperature + 10))
      )
    )
  }
}

function decodeTemperature(
  field: string,
  value: number,
  schema: Schema.Schema<number>
): Effect.Effect<number, KeylightValidationError> {
  return Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new KeylightValidationError(
          field,
          value,
          undefined,
          undefined,
          cause.message
        )
    )
  )
}
