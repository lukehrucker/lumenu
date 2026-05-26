import bonjour = require('bonjour')
import type { RemoteService } from 'bonjour'
import { Data, Effect } from 'effect'

import { getReachableIPv4Addresses } from './utils.js'

export class DiscoveryError extends Data.TaggedError('DiscoveryError')<{
  readonly cause: unknown
}> {}

export class InvalidDiscoveryOptions extends Data.TaggedError(
  'InvalidDiscoveryOptions'
)<{
  readonly message: string
}> {}

export type mDNSError = DiscoveryError | InvalidDiscoveryOptions

export interface DiscoveryOptions {
  readonly serviceType: string
  readonly timeout?: number
}

interface ValidatedDiscoveryOptions {
  readonly serviceType: string
  readonly timeout: number
}

export namespace mDNS {
  const defaultDiscoveryTimeout = 5000

  const validateDiscoveryOptions = (
    options: DiscoveryOptions
  ): Effect.Effect<ValidatedDiscoveryOptions, InvalidDiscoveryOptions> => {
    const timeout = options.timeout ?? defaultDiscoveryTimeout

    if (options.serviceType.trim().length === 0) {
      return Effect.fail(
        new InvalidDiscoveryOptions({
          message: 'serviceType must not be empty',
        })
      )
    }

    if (!Number.isFinite(timeout) || timeout <= 0) {
      return Effect.fail(
        new InvalidDiscoveryOptions({
          message: 'timeout must be a positive number of milliseconds',
        })
      )
    }

    return Effect.succeed({
      serviceType: options.serviceType,
      timeout,
    })
  }

  const discoverWithBonjour = ({
    serviceType,
    timeout,
  }: ValidatedDiscoveryOptions): Effect.Effect<string[], DiscoveryError> =>
    Effect.async<string[], DiscoveryError>((resume) => {
      try {
        const bonjourInstance = bonjour()
        const browser = bonjourInstance.find({ type: serviceType })
        const discoveredIPs = new Set<string>()

        let cleanedUp = false
        let completed = false
        let timer: ReturnType<typeof setTimeout>

        const cleanup = () => {
          if (cleanedUp) {
            return
          }

          cleanedUp = true
          clearTimeout(timer)
          browser.stop()
          bonjourInstance.destroy()
        }

        const complete = (effect: Effect.Effect<string[], DiscoveryError>) => {
          if (completed) {
            return
          }

          completed = true
          resume(effect)
        }

        browser.on('up', (service: RemoteService) => {
          for (const address of getReachableIPv4Addresses(service)) {
            discoveredIPs.add(address)
          }
        })

        timer = setTimeout(() => {
          try {
            cleanup()
            complete(Effect.succeed(Array.from(discoveredIPs)))
          } catch (cause) {
            complete(Effect.fail(new DiscoveryError({ cause })))
          }
        }, timeout)

        return Effect.sync(cleanup)
      } catch (cause) {
        resume(Effect.fail(new DiscoveryError({ cause })))
        return Effect.void
      }
    })

  export const discover = Effect.fn('mDNS.discover')(function* (
    options: DiscoveryOptions
  ) {
    const validated = yield* validateDiscoveryOptions(options)
    return yield* discoverWithBonjour(validated)
  })
}
