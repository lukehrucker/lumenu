import { TextAttributes } from '@opentui/core'

import type { DiscoveryStatus } from '../core/discovery.js'

const labels: Record<DiscoveryStatus, string> = {
  discovered: 'DISCOVERED',
  probing: 'PROBING',
  identified: 'READY',
  unreachable: 'OFFLINE',
  unsupported: 'UNSUPPORTED',
}

export function StatusBadge({ status }: { status: DiscoveryStatus }) {
  return <span attributes={TextAttributes.BOLD}>[{labels[status]}]</span>
}
