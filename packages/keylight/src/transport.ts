import { Effect, Schema } from 'effect'

import {
  KeylightBadRequestError,
  KeylightConnectionError,
  KeylightDecodeError,
  KeylightHttpError,
  KeylightValidationError,
} from './errors.js'
import { createClient } from './generated/client/index.js'
import type { Client } from './generated/client/index.js'
import {
  getAccessoryInfo,
  getLightsStatus,
  getLightSettings,
  identifyDevice,
  updateAccessoryInfo,
  updateLightsStatus,
  updateLightSettings,
} from './generated/sdk.gen.js'
import type {
  AccessoryInfo,
  AccessoryInfoUpdate,
  LightSettings,
  LightSettingsUpdate,
  LightsStatus,
  LightsUpdate,
} from './types.js'
import * as KeylightSchema from './schemas.js'

export type KeylightTransportError =
  | KeylightConnectionError
  | KeylightHttpError
  | KeylightBadRequestError
  | KeylightDecodeError
  | KeylightValidationError

interface GeneratedResult<A, E> {
  readonly data?: A
  readonly error?: E
  readonly response?: Response
}

export interface KeylightTransportOptions {
  readonly fetch?: typeof fetch
}

interface DecodeOptions<A, I> {
  readonly endpoint: string
  readonly schema: Schema.Schema<A, I>
}

function makeBaseUrl(host: string): string {
  return `http://${host}:9123`
}

function makeClient(
  host: string,
  options: KeylightTransportOptions = {}
): Client {
  return createClient({
    baseUrl: makeBaseUrl(host),
    fetch: options.fetch,
  })
}

function formatUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (value === undefined) {
    return undefined
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function decodeResponse<A, I>(
  value: unknown,
  options: DecodeOptions<A, I>
): Effect.Effect<A, KeylightDecodeError> {
  return Schema.decodeUnknown(options.schema)(value).pipe(
    Effect.mapError((cause) => new KeylightDecodeError(options.endpoint, cause))
  )
}

function encodeInput<A, I>(
  field: string,
  value: unknown,
  schema: Schema.Schema<A, I>
): Effect.Effect<I, KeylightValidationError> {
  return Schema.encodeUnknown(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new KeylightValidationError(
          field,
          value,
          undefined,
          undefined,
          cause.message
        )
    )
  )
}

function unwrapGenerated<A, E>(
  endpoint: string,
  request: () => Promise<GeneratedResult<A, E>>
): Effect.Effect<
  A,
  KeylightConnectionError | KeylightHttpError | KeylightBadRequestError
> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise<
      GeneratedResult<A, E>,
      KeylightConnectionError
    >({
      try: request,
      catch: (cause) => new KeylightConnectionError(endpoint, cause),
    })

    if (result.error !== undefined) {
      const status = result.response?.status
      const details = formatUnknown(result.error)

      if (status === 400) {
        return yield* Effect.fail(
          new KeylightBadRequestError(endpoint, details)
        )
      }

      if (status !== undefined) {
        return yield* Effect.fail(
          new KeylightHttpError(endpoint, status, details)
        )
      }

      return yield* Effect.fail(
        new KeylightConnectionError(endpoint, result.error)
      )
    }

    if (result.data === undefined) {
      return yield* Effect.fail(new KeylightConnectionError(endpoint))
    }

    return result.data
  })
}

function runJson<A, I, E>(
  endpoint: string,
  schema: Schema.Schema<A, I>,
  request: () => Promise<GeneratedResult<unknown, E>>
): Effect.Effect<
  A,
  | KeylightConnectionError
  | KeylightHttpError
  | KeylightBadRequestError
  | KeylightDecodeError
> {
  return unwrapGenerated(endpoint, request).pipe(
    Effect.flatMap((response) => decodeResponse(response, { endpoint, schema }))
  )
}

export interface KeylightService {
  readonly identify: (
    host: string
  ) => Effect.Effect<
    void,
    KeylightConnectionError | KeylightHttpError | KeylightBadRequestError
  >
  readonly getAccessoryInfo: (
    host: string
  ) => Effect.Effect<AccessoryInfo, KeylightTransportError>
  readonly updateAccessoryInfo: (
    host: string,
    info: AccessoryInfoUpdate
  ) => Effect.Effect<AccessoryInfo, KeylightTransportError>
  readonly getLights: (
    host: string
  ) => Effect.Effect<LightsStatus, KeylightTransportError>
  readonly updateLights: (
    host: string,
    lights: LightsUpdate
  ) => Effect.Effect<LightsStatus, KeylightTransportError>
  readonly getSettings: (
    host: string
  ) => Effect.Effect<LightSettings, KeylightTransportError>
  readonly updateSettings: (
    host: string,
    settings: LightSettingsUpdate
  ) => Effect.Effect<LightSettings, KeylightTransportError>
}

export function makeKeylightService(
  options: KeylightTransportOptions = {}
): KeylightService {
  return {
    identify: (host) => {
      const endpoint = '/elgato/identify'
      const client = makeClient(host, options)

      return unwrapGenerated(endpoint, () => identifyDevice({ client })).pipe(
        Effect.asVoid
      )
    },

    getAccessoryInfo: (host) => {
      const endpoint = '/elgato/accessory-info'
      const client = makeClient(host, options)

      return runJson(endpoint, KeylightSchema.AccessoryInfo, () =>
        getAccessoryInfo({ client })
      )
    },

    updateAccessoryInfo: (host, info) => {
      const endpoint = '/elgato/accessory-info'
      const client = makeClient(host, options)

      return encodeInput(
        'accessoryInfo',
        info,
        KeylightSchema.AccessoryInfoUpdate
      ).pipe(
        Effect.flatMap((body) =>
          runJson(endpoint, KeylightSchema.AccessoryInfo, () =>
            updateAccessoryInfo({ client, body })
          )
        )
      )
    },

    getLights: (host) => {
      const endpoint = '/elgato/lights'
      const client = makeClient(host, options)

      return runJson(endpoint, KeylightSchema.LightsStatus, () =>
        getLightsStatus({ client })
      )
    },

    updateLights: (host, lights) => {
      const endpoint = '/elgato/lights'
      const client = makeClient(host, options)

      return encodeInput('lights', lights, KeylightSchema.LightsUpdate).pipe(
        Effect.flatMap((body) =>
          runJson(endpoint, KeylightSchema.LightsStatus, () =>
            updateLightsStatus({ client, body })
          )
        )
      )
    },

    getSettings: (host) => {
      const endpoint = '/elgato/lights/settings'
      const client = makeClient(host, options)

      return runJson(endpoint, KeylightSchema.LightSettings, () =>
        getLightSettings({ client })
      )
    },

    updateSettings: (host, settings) => {
      const endpoint = '/elgato/lights/settings'
      const client = makeClient(host, options)

      return encodeInput(
        'settings',
        settings,
        KeylightSchema.LightSettingsUpdate
      ).pipe(
        Effect.flatMap((body) =>
          runJson(endpoint, KeylightSchema.LightSettings, () =>
            updateLightSettings({ client, body })
          )
        )
      )
    },
  }
}
