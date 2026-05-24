import bonjour = require('bonjour')
import type { RemoteService } from 'bonjour'
import { Data, Effect } from 'effect'

export namespace Mdns {
  export class DiscoveryError extends Data.TaggedError('DiscoveryError')<{
    readonly cause: unknown
  }> {}

  const isLocalhost = (address: string) =>
    address === '127.0.0.1' || address === '0.0.0.0' || address === '::1'

  const isIPv6 = (address: string) => address.includes(':')

  export function discover({
    serviceType,
    timeout = 5000,
  }: {
    serviceType: string
    timeout?: number
  }): Effect.Effect<string[], DiscoveryError> {
    return Effect.async<string[], DiscoveryError>((resume) => {
      try {
        const bonjourInstance = bonjour()
        const browser = bonjourInstance.find({ type: serviceType })

        const discoveredIPs = new Set<string>()

        browser.on('up', (service: RemoteService) => {
          if (service.addresses && service.addresses.length > 0) {
            for (const address of service.addresses) {
              if (!isIPv6(address) && !isLocalhost(address)) {
                discoveredIPs.add(address)
              }
            }
          } else if (service.referer?.address) {
            const address = service.referer.address
            if (!isIPv6(address) && !isLocalhost(address)) {
              discoveredIPs.add(address)
            }
          }
        })

        const timer = setTimeout(() => {
          browser.stop()
          bonjourInstance.destroy()
          resume(Effect.succeed(Array.from(discoveredIPs)))
        }, timeout)

        return Effect.sync(() => {
          clearTimeout(timer)
          browser.stop()
          bonjourInstance.destroy()
        })
      } catch (cause) {
        resume(Effect.fail(new DiscoveryError({ cause })))
        return Effect.void
      }
    })
  }
}
