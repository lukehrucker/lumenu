import { createRoot } from '@opentui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NodeRuntime } from '@effect/platform-node'
import { Cause, Effect, Exit, ManagedRuntime } from 'effect'

import { CenteredMessage } from './components/centered-message.js'
import { useDevicesQuery } from './core/devices.js'
import {
  lumenuLayer,
  LumenuRuntimeProvider,
  type LumenuManagedRuntime,
} from './core/lumenu-runtime.js'
import { TuiRenderer, tuiRendererLayer } from './core/tui-renderer.js'

const queryClient = new QueryClient()

function App() {
  const devices = useDevicesQuery()

  if (devices.isPending) {
    return <CenteredMessage title="Lumenu" message="Loading saved lights..." />
  }

  if (devices.isError) {
    return (
      <CenteredMessage
        title="Storage Error"
        message={String(devices.error)}
        dim={false}
      />
    )
  }

  if (devices.data.length === 0) {
    return (
      <CenteredMessage
        title="No Saved Lights"
        message="Onboarding discovery will start here."
      />
    )
  }

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text>Saved Lights</text>
      <box flexDirection="column" marginTop={1}>
        {devices.data.map((device) => (
          <text key={device.serialNumber}>
            {device.displayName} ({device.host})
          </text>
        ))}
      </box>
    </box>
  )
}

function renderApp(runtime: LumenuManagedRuntime) {
  return TuiRenderer.pipe(
    Effect.flatMap(({ renderer, awaitDestroyed }) =>
      Effect.sync(() => {
        createRoot(renderer).render(
          <LumenuRuntimeProvider runtime={runtime}>
            <QueryClientProvider client={queryClient}>
              <App />
            </QueryClientProvider>
          </LumenuRuntimeProvider>
        )
      }).pipe(Effect.zipRight(awaitDestroyed))
    )
  )
}

const main = Effect.scoped(
  Effect.gen(function* () {
    const runtime = yield* Effect.acquireRelease(
      Effect.sync(() => ManagedRuntime.make(lumenuLayer)),
      (runtime) => Effect.promise(() => runtime.dispose())
    )

    yield* renderApp(runtime).pipe(Effect.provide(tuiRendererLayer))
  })
)

NodeRuntime.runMain(main, {
  teardown: (exit) => {
    const code =
      Exit.isFailure(exit) && !Cause.isInterruptedOnly(exit.cause) ? 1 : 0

    process.exit(code)
  },
})
