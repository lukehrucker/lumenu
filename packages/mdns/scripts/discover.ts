import { mDNS } from '../src/index.js'
import { Effect } from 'effect'

/**
 * Discover Elgato Key Lights on the local network using mDNS
 *
 * This script searches for devices advertising the '_elg._tcp' service type,
 * which is used by Elgato Key Light, Key Light Air, Ring Light, and Light Strip.
 *
 * Usage: bun run scripts/discover.ts
 */

const DISCOVERY_TIMEOUT = 5000 // 5 seconds
const SERVICE_TYPE = 'elg'

const ips = await Effect.runPromise(
  mDNS.discover({
    serviceType: SERVICE_TYPE,
    timeout: DISCOVERY_TIMEOUT,
  })
)

if (ips.length === 0) {
  console.log('No Elgato Key Lights found on the network')
} else {
  // Print each unique IP address on a separate line
  for (const ip of ips) {
    console.log(ip)
  }
}

process.exit(0)
