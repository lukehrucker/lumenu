import * as React from 'react'
import { createCollection, useLiveQuery } from '@tanstack/react-db'
import type { UpdateMutationFnParams } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'

import { Keylight, Temperature } from '@lumenu/keylight'
import type { Light, LightsStatus } from '@lumenu/keylight'
import { Storage } from '@lumenu/storage'
import type { DeviceRow, DeviceStateInput } from '@lumenu/storage'

import { useLumenuRuntime, type LumenuRuntime } from '../lumenu-runtime.js'

export interface LightRecord {
  serialNumber: string
  host: string
  displayName: string
  productName: string | null
  firmwareVersion: string | null
  firmwareBuildNumber: number | null
  on: boolean | null
  brightness: number | null
  temperature: number | null
  lastSeenAt: string | null
}

interface SetPowerAction {
  kind: 'setPower'
  on: boolean
}

interface SetBrightnessAction {
  kind: 'setBrightness'
  brightness: number
}

interface SetTemperatureKelvinAction {
  kind: 'setTemperatureKelvin'
  kelvin: number
}

type LightMutationAction =
  | SetPowerAction
  | SetBrightnessAction
  | SetTemperatureKelvinAction

interface LightActionState {
  readonly isPending: boolean
  readonly pendingSerialNumber: string | null
  readonly error: string | null
}

function storagePowerToBoolean(value: number | null): boolean | null {
  if (value === 1) {
    return true
  }

  if (value === 0) {
    return false
  }

  return null
}

function booleanToStoragePower(value: boolean | null): 0 | 1 | null {
  if (value === null) {
    return null
  }

  return value ? 1 : 0
}

function deviceToLightRecord(device: DeviceRow): LightRecord {
  return {
    serialNumber: device.serialNumber,
    host: device.host,
    displayName: device.displayName,
    productName: device.productName,
    firmwareVersion: device.firmwareVersion,
    firmwareBuildNumber: device.firmwareBuildNumber,
    on: storagePowerToBoolean(device.lastOn),
    brightness: device.lastBrightness,
    temperature: device.lastTemperature,
    lastSeenAt: device.lastSeenAt,
  }
}

function lightStatusToDeviceState(status: LightsStatus): DeviceStateInput {
  const light = status.lights[0]

  return {
    lastOn: light?.on === undefined ? null : booleanToStoragePower(light.on),
    lastBrightness: light?.brightness ?? null,
    lastTemperature: light?.temperature ?? null,
    lastSeenAt: new Date().toISOString(),
  }
}

export function discoveredLightToDeviceState(
  light: Light | undefined
): Pick<
  DeviceStateInput,
  'lastOn' | 'lastBrightness' | 'lastTemperature' | 'lastSeenAt'
> {
  return {
    lastOn:
      light?.on === undefined ? undefined : booleanToStoragePower(light.on),
    lastBrightness: light?.brightness,
    lastTemperature: light?.temperature,
    lastSeenAt: new Date().toISOString(),
  }
}

export function apiTemperatureToKelvin(value: number | null): number | null {
  if (value === null) {
    return null
  }

  return Effect.runSync(
    Temperature.apiToKelvin(value).pipe(
      Effect.catchAll(() => Effect.succeed(null))
    )
  )
}

export function kelvinToApiTemperature(value: number): number | null {
  return Effect.runSync(
    Temperature.kelvinToApi(value).pipe(
      Effect.catchAll(() => Effect.succeed(null))
    )
  )
}

export function lastTemperatureKelvin(temperature: number | null) {
  return apiTemperatureToKelvin(temperature)
}

const listLights = Storage.pipe(
  Effect.flatMap((storage) => storage.listDevices()),
  Effect.map((devices) => devices.map(deviceToLightRecord))
)

function lightMutationActionFromMetadata(
  metadata: unknown
): LightMutationAction | undefined {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    !('kind' in metadata)
  ) {
    return undefined
  }

  if (
    metadata.kind === 'setPower' &&
    'on' in metadata &&
    typeof metadata.on === 'boolean'
  ) {
    return { kind: 'setPower', on: metadata.on }
  }

  if (
    metadata.kind === 'setBrightness' &&
    'brightness' in metadata &&
    typeof metadata.brightness === 'number'
  ) {
    return {
      kind: 'setBrightness',
      brightness: metadata.brightness,
    }
  }

  if (
    metadata.kind === 'setTemperatureKelvin' &&
    'kelvin' in metadata &&
    typeof metadata.kelvin === 'number'
  ) {
    return {
      kind: 'setTemperatureKelvin',
      kelvin: metadata.kelvin,
    }
  }

  return undefined
}

function executeLightAction(keylight: Keylight, action: LightMutationAction) {
  switch (action.kind) {
    case 'setPower':
      return action.on ? keylight.turnOn() : keylight.turnOff()
    case 'setBrightness':
      return keylight.setBrightness(action.brightness)
    case 'setTemperatureKelvin':
      return keylight.setTemperatureKelvin(action.kelvin)
  }
}

function persistLightAction(light: LightRecord, action: LightMutationAction) {
  return Effect.gen(function* () {
    const keylight = Keylight.make(light.host)
    const status = yield* executeLightAction(keylight, action)

    yield* Storage.pipe(
      Effect.flatMap((storage) =>
        storage.updateDeviceState(
          light.serialNumber,
          lightStatusToDeviceState(status)
        )
      )
    )
  })
}

function createLightsCollection({
  queryClient,
  runtime,
}: {
  queryClient: QueryClient
  runtime: LumenuRuntime
}) {
  return createCollection(
    queryCollectionOptions({
      id: 'lights',
      queryKey: ['lights'],
      queryClient,
      queryFn: () => runtime.runPromise(listLights),
      getKey: (light: LightRecord) => light.serialNumber,
      compare: (left, right) =>
        left.displayName.localeCompare(right.displayName),
      onUpdate: async (params: UpdateMutationFnParams<LightRecord>) => {
        for (const mutation of params.transaction.mutations) {
          const action = lightMutationActionFromMetadata(mutation.metadata)

          if (!action) {
            continue
          }

          await runtime.runPromise(
            persistLightAction(mutation.original, action)
          )
        }
      },
    })
  )
}

type LightsCollection = ReturnType<typeof createLightsCollection>

const LightsCollectionContext = React.createContext<LightsCollection | null>(
  null
)

export function LightsProvider({ children }: { children: React.ReactNode }) {
  const runtime = useLumenuRuntime()
  const queryClient = useQueryClient()
  const collection = React.useMemo(
    () => createLightsCollection({ queryClient, runtime }),
    [queryClient, runtime]
  )

  return (
    <LightsCollectionContext.Provider value={collection}>
      {children}
    </LightsCollectionContext.Provider>
  )
}

export function useLightsCollection(): LightsCollection {
  const collection = React.useContext(LightsCollectionContext)

  if (!collection) {
    throw new Error('useLightsCollection must be used within LightsProvider')
  }

  return collection
}

export function useLights() {
  const collection = useLightsCollection()
  const result = useLiveQuery(collection)

  return {
    ...result,
    data: [...result.data].sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
    ),
    error: collection.utils.lastError,
    isError: result.isError || collection.utils.isError,
    isLoading: result.isLoading || collection.utils.isLoading,
  }
}

function useTrackedLightAction() {
  const [state, setState] = React.useState<LightActionState>({
    isPending: false,
    pendingSerialNumber: null,
    error: null,
  })

  const track = React.useCallback(
    (serialNumber: string, promise: Promise<unknown>) => {
      setState({
        isPending: true,
        pendingSerialNumber: serialNumber,
        error: null,
      })

      void promise
        .then(() => {
          setState({
            isPending: false,
            pendingSerialNumber: null,
            error: null,
          })
        })
        .catch((error: unknown) => {
          setState({
            isPending: false,
            pendingSerialNumber: null,
            error: String(error),
          })
        })
    },
    []
  )

  return { ...state, track }
}

export function useToggleLightPower() {
  const collection = useLightsCollection()
  const action = useTrackedLightAction()

  return {
    ...action,
    mutate: (serialNumber: string) => {
      const light = collection.get(serialNumber)

      if (!light || action.isPending) {
        return
      }

      const on = light.on !== true
      const transaction = collection.update(
        serialNumber,
        { metadata: { kind: 'setPower', on } },
        (draft) => {
          draft.on = on
        }
      )

      action.track(serialNumber, transaction.isPersisted.promise)
    },
  }
}

export function useSetLightBrightness() {
  const collection = useLightsCollection()
  const action = useTrackedLightAction()

  return {
    ...action,
    mutate: ({
      brightness,
      serialNumber,
    }: {
      serialNumber: string
      brightness: number
    }) => {
      if (action.isPending) {
        return
      }

      const transaction = collection.update(
        serialNumber,
        { metadata: { kind: 'setBrightness', brightness } },
        (draft) => {
          draft.brightness = brightness
        }
      )

      action.track(serialNumber, transaction.isPersisted.promise)
    },
  }
}

export function useSetLightTemperatureKelvin() {
  const collection = useLightsCollection()
  const action = useTrackedLightAction()

  return {
    ...action,
    mutate: ({
      kelvin,
      serialNumber,
    }: {
      serialNumber: string
      kelvin: number
    }) => {
      if (action.isPending) {
        return
      }

      const apiTemperature = kelvinToApiTemperature(kelvin)
      const transaction = collection.update(
        serialNumber,
        { metadata: { kind: 'setTemperatureKelvin', kelvin } },
        (draft) => {
          draft.temperature = apiTemperature ?? draft.temperature
        }
      )

      action.track(serialNumber, transaction.isPersisted.promise)
    },
  }
}
