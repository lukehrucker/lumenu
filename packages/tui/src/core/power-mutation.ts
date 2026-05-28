import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'

import { Keylight } from '@lumenu/keylight'
import type { DeviceRow } from '@lumenu/storage'
import { Storage } from '@lumenu/storage'

import { useLumenuRuntime } from './lumenu-runtime.js'

function setDevicePower(device: DeviceRow, on: boolean) {
  return Effect.gen(function* () {
    const keylight = Keylight.make(device.host)
    const status = yield* on ? keylight.turnOn() : keylight.turnOff()
    const light = status.lights[0]

    return yield* Storage.pipe(
      Effect.flatMap((storage) =>
        storage.updateDeviceState(device.serialNumber, {
          lastOn: light?.on === undefined ? null : light.on ? 1 : 0,
          lastBrightness: light?.brightness ?? null,
          lastTemperature: light?.temperature ?? null,
          lastSeenAt: new Date().toISOString(),
        })
      )
    )
  })
}

export function usePowerMutation() {
  const runtime = useLumenuRuntime()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (device: DeviceRow) => {
      const nextPower = device.lastOn !== 1

      return runtime.runPromise(setDevicePower(device, nextPower))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}
