import * as React from 'react'
import { createCollection, useLiveQuery } from '@tanstack/react-db'
import type { UpdateMutationFnParams } from '@tanstack/db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'

import { Keylight, Temperature } from '@lumenu/keylight'
import type { Light, LightsStatus, LightUpdate } from '@lumenu/keylight'
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

function lightUpdateFromMutation(
  original: LightRecord,
  modified: LightRecord
): LightUpdate {
  const update: LightUpdate = {}

  if (modified.on !== null && modified.on !== original.on) {
    update.on = modified.on
  }

  if (
    modified.brightness !== null &&
    modified.brightness !== original.brightness
  ) {
    update.brightness = modified.brightness
  }

  if (
    modified.temperature !== null &&
    modified.temperature !== original.temperature
  ) {
    update.temperature = modified.temperature
  }

  return update
}

function persistLightUpdate(original: LightRecord, modified: LightRecord) {
  return Effect.gen(function* () {
    const update = lightUpdateFromMutation(original, modified)

    if (Object.keys(update).length === 0) {
      return
    }

    const status = yield* Keylight.make(original.host).setLight(update)

    yield* Storage.pipe(
      Effect.flatMap((storage) =>
        storage.updateDeviceState(
          original.serialNumber,
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
          await runtime.runPromise(
            persistLightUpdate(mutation.original, mutation.modified)
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
      const transaction = collection.update(serialNumber, (draft) => {
        draft.on = on
      })

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

      const transaction = collection.update(serialNumber, (draft) => {
        draft.brightness = brightness
      })

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

      if (apiTemperature === null) {
        return
      }

      const transaction = collection.update(serialNumber, (draft) => {
        draft.temperature = apiTemperature
      })

      action.track(serialNumber, transaction.isPersisted.promise)
    },
  }
}
