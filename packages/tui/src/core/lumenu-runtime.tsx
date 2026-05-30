import * as React from 'react'
import { Effect, ManagedRuntime } from 'effect'

import { Storage } from '@lumenu/storage'

type LumenuRequirements = Storage

export interface LumenuRuntime {
  readonly runPromise: <A, E>(
    effect: Effect.Effect<A, E, LumenuRequirements>
  ) => Promise<A>
}

const LumenuRuntimeContext = React.createContext<LumenuRuntime | null>(null)

export const lumenuLayer = Storage.layer()

export type LumenuManagedRuntime = ManagedRuntime.ManagedRuntime<
  LumenuRequirements,
  unknown
>

export function LumenuRuntimeProvider({
  children,
  runtime,
}: {
  children: React.ReactNode
  runtime: LumenuManagedRuntime
}) {
  const value = React.useMemo<LumenuRuntime>(
    () => ({
      runPromise: (effect) => runtime.runPromise(effect),
    }),
    [runtime]
  )

  return (
    <LumenuRuntimeContext.Provider value={value}>
      {children}
    </LumenuRuntimeContext.Provider>
  )
}

export function useLumenuRuntime(): LumenuRuntime {
  const runtime = React.useContext(LumenuRuntimeContext)

  if (!runtime) {
    throw new Error(
      'useLumenuRuntime must be used within LumenuRuntimeProvider'
    )
  }

  return runtime
}
