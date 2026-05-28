import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'

import type { LightsStatus } from '@lumenu/keylight'
import { Keylight } from '@lumenu/keylight'
import type { DeviceRow } from '@lumenu/storage'
import { Storage } from '@lumenu/storage'

import { useLumenuRuntime } from './lumenu-runtime.js'

interface LightMutationInput {
  device: DeviceRow
  value: number
}

function updateDeviceFromLightStatus(device: DeviceRow, status: LightsStatus) {
  const light = status.lights[0]

  return Storage.pipe(
    Effect.flatMap((storage) =>
      storage.updateDeviceState(device.serialNumber, {
        lastOn: light?.on === undefined ? null : light.on ? 1 : 0,
        lastBrightness: light?.brightness ?? null,
        lastTemperature: light?.temperature ?? null,
        lastSeenAt: new Date().toISOString(),
      })
    )
  )
}

function setDevicePower(device: DeviceRow, on: boolean) {
  return Effect.gen(function* () {
    const keylight = Keylight.make(device.host)
    const status = yield* on ? keylight.turnOn() : keylight.turnOff()

    return yield* updateDeviceFromLightStatus(device, status)
  })
}

function setDeviceBrightness(device: DeviceRow, brightness: number) {
  return Effect.gen(function* () {
    const keylight = Keylight.make(device.host)
    const status = yield* keylight.setBrightness(brightness)

    return yield* updateDeviceFromLightStatus(device, status)
  })
}

function setDeviceTemperature(device: DeviceRow, kelvin: number) {
  return Effect.gen(function* () {
    const keylight = Keylight.make(device.host)
    const status = yield* keylight.setTemperatureKelvin(kelvin)

    return yield* updateDeviceFromLightStatus(device, status)
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

export function useBrightnessMutation() {
  const runtime = useLumenuRuntime()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ device, value }: LightMutationInput) => {
      return runtime.runPromise(setDeviceBrightness(device, value))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

export function useTemperatureMutation() {
  const runtime = useLumenuRuntime()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ device, value }: LightMutationInput) => {
      return runtime.runPromise(setDeviceTemperature(device, value))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}
