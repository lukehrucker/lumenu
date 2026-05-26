import { Effect } from 'effect'

import type { AccessoryInfo, Light } from '@lumenu/keylight'
import { Keylight } from '@lumenu/keylight'
import type { DeviceInput } from '@lumenu/storage'
import { Storage } from '@lumenu/storage'

export type DiscoveryStatus =
  | 'discovered'
  | 'probing'
  | 'identified'
  | 'unreachable'
  | 'unsupported'

export interface DiscoveredDevice {
  host: string
  status: DiscoveryStatus
  selected: boolean
  info?: AccessoryInfo
  light?: Light
  error?: string
}

export function probeHost(host: string) {
  const keylight = Keylight.make(host)

  return keylight.getAccessoryInfo().pipe(
    Effect.flatMap((info) =>
      keylight.getLights().pipe(
        Effect.map(
          (lights): DiscoveredDevice => ({
            host,
            status: info.serialNumber ? 'identified' : 'unsupported',
            selected: Boolean(info.serialNumber),
            info,
            light: lights.lights[0],
          })
        )
      )
    )
  )
}

export function identifyHost(host: string) {
  return Keylight.make(host).identify()
}

export function saveDiscoveredDevices(devices: DiscoveredDevice[]) {
  const inputs = devices.flatMap((device): DeviceInput[] => {
    if (!device.selected || !device.info?.serialNumber) {
      return []
    }

    return [
      {
        serialNumber: device.info.serialNumber,
        host: device.host,
        displayName: device.info.displayName,
        productName: device.info.productName,
        firmwareVersion: device.info.firmwareVersion,
        firmwareBuildNumber: device.info.firmwareBuildNumber,
        lastOn: device.light?.on,
        lastBrightness: device.light?.brightness,
        lastTemperature: device.light?.temperature,
        lastSeenAt: new Date().toISOString(),
      },
    ]
  })

  return Storage.pipe(
    Effect.flatMap((storage) =>
      Effect.forEach(inputs, (device) => storage.upsertDevice(device))
    )
  )
}
