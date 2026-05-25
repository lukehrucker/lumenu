import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'

import type { DeviceRow } from '@lumenu/storage'
import { Storage } from '@lumenu/storage'

import { useLumenuRuntime } from './lumenu-runtime.js'

const listDevices = Storage.pipe(
  Effect.flatMap((storage) => storage.listDevices())
)

export function useDevicesQuery() {
  const runtime = useLumenuRuntime()

  return useQuery({
    queryKey: ['devices'],
    queryFn: (): Promise<DeviceRow[]> => runtime.runPromise(listDevices),
  })
}
