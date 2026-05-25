import { createCliRenderer, type CliRenderer } from '@opentui/core'
import { Context, Deferred, Effect, Layer } from 'effect'

export interface TuiRenderer {
  readonly renderer: CliRenderer
  readonly awaitDestroyed: Effect.Effect<void>
}

export const TuiRenderer = Context.GenericTag<TuiRenderer>(
  '@lumenu/tui/TuiRenderer'
)

export const tuiRendererLayer = Layer.scoped(
  TuiRenderer,
  Effect.gen(function* () {
    const rendererDestroyed = yield* Deferred.make<void>()
    const renderer = yield* Effect.acquireRelease(
      Effect.promise(() =>
        createCliRenderer({
          onDestroy: () => {
            void Effect.runPromise(
              Deferred.succeed(rendererDestroyed, undefined)
            )
          },
        })
      ),
      (renderer) =>
        Effect.sync(() => {
          if (!renderer.isDestroyed) {
            renderer.destroy()
          }
        })
    )

    return {
      renderer,
      awaitDestroyed: Deferred.await(rendererDestroyed),
    }
  })
)
