import { Context, Effect, Layer } from 'effect'

import { KeylightConnectionError } from './errors.js'

/**
 * HTTP client abstraction for dependency injection and testing
 */

export interface HttpResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
}

/**
 * Injectable HTTP client interface for making requests
 */
export interface HttpClient {
  get<T>(url: string): Effect.Effect<HttpResponse<T>, KeylightConnectionError>
  put<T>(
    url: string,
    body: unknown
  ): Effect.Effect<HttpResponse<T>, KeylightConnectionError>
  post<T>(
    url: string,
    body?: unknown
  ): Effect.Effect<HttpResponse<T>, KeylightConnectionError>
}

export const HttpClient = Context.GenericTag<HttpClient>(
  '@lumenu/keylight/HttpClient'
)

/**
 * Default HTTP client implementation using native fetch
 */
export class FetchHttpClient implements HttpClient {
  static readonly layer = Layer.succeed(HttpClient, new FetchHttpClient())

  get<T>(url: string): Effect.Effect<HttpResponse<T>, KeylightConnectionError> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })

        const data = response.ok ? ((await response.json()) as T) : (null as T)

        return {
          ok: response.ok,
          status: response.status,
          data,
        }
      },
      catch: (cause) => new KeylightConnectionError(url, cause as Error),
    })
  }

  put<T>(
    url: string,
    body: unknown
  ): Effect.Effect<HttpResponse<T>, KeylightConnectionError> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        const data = response.ok ? ((await response.json()) as T) : (null as T)

        return {
          ok: response.ok,
          status: response.status,
          data,
        }
      },
      catch: (cause) => new KeylightConnectionError(url, cause as Error),
    })
  }

  post<T>(
    url: string,
    body?: unknown
  ): Effect.Effect<HttpResponse<T>, KeylightConnectionError> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        })

        const data =
          response.ok && response.status !== 204
            ? ((await response.json()) as T)
            : (null as T)

        return {
          ok: response.ok,
          status: response.status,
          data,
        }
      },
      catch: (cause) => new KeylightConnectionError(url, cause as Error),
    })
  }
}
