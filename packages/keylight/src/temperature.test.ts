import { describe, expect, test } from 'bun:test'

import { KeylightValidationError } from './errors.js'
import { Temperature } from './temperature.js'

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
