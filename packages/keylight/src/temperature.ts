import { KeylightValidationError } from './errors.js'

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
