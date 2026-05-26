import { describe, expect, test } from 'bun:test'
import { getReachableIPv4Addresses } from './utils.js'

describe('getReachableIPv4Addresses', () => {
  test('filters localhost and IPv6 addresses', () => {
    expect(
      getReachableIPv4Addresses({
        addresses: ['127.0.0.1', '192.168.1.10', '::1', 'fe80::1'],
        referer: { address: '192.168.1.11' },
      })
    ).toEqual(['192.168.1.10'])
  })

  test('falls back to referer address when no addresses are present', () => {
    expect(
      getReachableIPv4Addresses({
        referer: { address: '192.168.1.11' },
      })
    ).toEqual(['192.168.1.11'])
  })
})
