import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { InvalidDiscoveryOptions, mDNS } from './index.js'

describe('mDNS.discover', () => {
  test('rejects empty service types before opening discovery', async () => {
    const error = await Effect.runPromise(
      Effect.flip(mDNS.discover({ serviceType: '', timeout: 1000 }))
    )

    expect(error).toBeInstanceOf(InvalidDiscoveryOptions)
    expect(error.message).toBe('serviceType must not be empty')
  })
})
