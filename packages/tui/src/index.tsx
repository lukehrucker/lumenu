import { createRoot } from '@opentui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NodeRuntime } from '@effect/platform-node'
import { Cause, Effect, Exit, ManagedRuntime } from 'effect'
import * as React from 'react'

import { CenteredMessage } from './components/centered-message.js'
import { AppShell } from './components/app-shell.js'
import { DashboardScreen } from './components/dashboard-screen.js'
import { HelpBar } from './components/help-bar.js'
import { OnboardingScreen } from './components/onboarding-screen.js'
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
  const [route, setRoute] = React.useState<'onboarding' | 'dashboard'>(
    'dashboard'
  )

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

  if (devices.data.length === 0 || route === 'onboarding') {
    return (
      <AppShell
        help={
          <HelpBar
            shortcuts={[
              'j/k move',
              'space select',
              'i identify',
              'r rescan',
              'enter save',
              'q quit',
            ]}
          />
        }
      >
        <OnboardingScreen onSaved={() => setRoute('dashboard')} />
      </AppShell>
    )
  }

  return (
    <AppShell
      help={<HelpBar shortcuts={['j/k move', 'a add device', 'q quit']} />}
    >
      <DashboardScreen
        devices={devices.data}
        onAddDevice={() => setRoute('onboarding')}
      />
    </AppShell>
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
