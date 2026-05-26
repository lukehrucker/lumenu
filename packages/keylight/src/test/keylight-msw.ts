import type { HttpHandler } from 'msw'
import type { AccessoryInfo, LightSettings, LightsStatus } from '../types.js'
import { afterAll, afterEach, beforeAll } from 'bun:test'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Keylight } from '../keylight.js'

interface KeylightMockState {
  accessoryInfo: AccessoryInfo
  lights: LightsStatus
  settings: LightSettings
}

interface RecordedRequest {
  method: string
  pathname: string
  body: unknown
  headers: Record<string, string>
}

interface CreateKeylightMockDeviceOptions extends Partial<KeylightMockState> {
  host?: string
}

interface KeylightMockDevice {
  host: string
  baseUrl: string
  handlers: HttpHandler[]
  requests: RecordedRequest[]
  useBadRequest(method: HttpMethod, endpoint: KeylightEndpoint): void
  useNetworkError(method: HttpMethod, endpoint: KeylightEndpoint): void
  getState(): KeylightMockState
  setState(update: Partial<KeylightMockState>): void
  reset(): void
}

type HttpMethod = 'GET' | 'PUT' | 'POST'

type KeylightEndpoint =
  | '/identify'
  | '/accessory-info'
  | '/lights'
  | '/lights/settings'

const defaultAccessoryInfo: AccessoryInfo = {
  productName: 'Elgato Key Light',
  hardwareBoardType: 53,
  firmwareBuildNumber: 192,
  firmwareVersion: '1.0.3',
  serialNumber: 'XXXXXXXXXXXX',
  displayName: '',
  features: ['lights'],
}

const defaultLights: LightsStatus = {
  numberOfLights: 1,
  lights: [{ on: 0, brightness: 25, temperature: 166 }],
}

const defaultSettings: LightSettings = {
  powerOnBehavior: 1,
  powerOnBrightness: 20,
  powerOnTemperature: 213,
  switchOnDurationMs: 100,
  switchOffDurationMs: 300,
  colorChangeDurationMs: 100,
}

const server = setupServer()

function setupKeylightMockServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
}

function setupKeylight(options: CreateKeylightMockDeviceOptions = {}): {
  device: KeylightMockDevice
  keylight: Keylight
} {
  const device = createKeylightMockDevice(options)
  server.use(...device.handlers)

  return {
    device,
    keylight: new Keylight(device.host),
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

async function recordRequest(
  requests: RecordedRequest[],
  request: Request
): Promise<unknown> {
  const body = await readJsonBody(request)

  requests.push({
    method: request.method,
    pathname: new URL(request.url).pathname,
    body,
    headers: Object.fromEntries(request.headers.entries()),
  })

  return body
}

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text()

  if (!text) {
    return undefined
  }

  return JSON.parse(text) as unknown
}

function createInitialState(
  options: CreateKeylightMockDeviceOptions
): KeylightMockState {
  return {
    accessoryInfo: clone(options.accessoryInfo ?? defaultAccessoryInfo),
    lights: clone(options.lights ?? defaultLights),
    settings: clone(options.settings ?? defaultSettings),
  }
}

function createKeylightMockDevice(
  options: CreateKeylightMockDeviceOptions = {}
): KeylightMockDevice {
  const host = options.host ?? '192.168.1.61'
  const baseUrl = `http://${host}:9123/elgato`
  const initialState = createInitialState(options)
  const requests: RecordedRequest[] = []
  let state = clone(initialState)

  const handlers = [
    http.post(`${baseUrl}/identify`, async ({ request }) => {
      await recordRequest(requests, request)
      return new HttpResponse(null)
    }),

    http.get(`${baseUrl}/accessory-info`, async ({ request }) => {
      await recordRequest(requests, request)
      return HttpResponse.json(state.accessoryInfo)
    }),

    http.put(`${baseUrl}/accessory-info`, async ({ request }) => {
      const body = (await recordRequest(
        requests,
        request
      )) as Partial<AccessoryInfo>
      state.accessoryInfo = { ...state.accessoryInfo, ...body }
      return HttpResponse.json(state.accessoryInfo)
    }),

    http.get(`${baseUrl}/lights`, async ({ request }) => {
      await recordRequest(requests, request)
      return HttpResponse.json(state.lights)
    }),

    http.put(`${baseUrl}/lights`, async ({ request }) => {
      const body = (await recordRequest(
        requests,
        request
      )) as Partial<LightsStatus>
      const updates = body.lights ?? []

      state.lights = {
        numberOfLights: body.numberOfLights ?? state.lights.numberOfLights,
        lights: state.lights.lights.map((light, index) => ({
          ...light,
          ...updates[index],
        })),
      }

      return HttpResponse.json(state.lights)
    }),

    http.get(`${baseUrl}/lights/settings`, async ({ request }) => {
      await recordRequest(requests, request)
      return HttpResponse.json(state.settings)
    }),

    http.put(`${baseUrl}/lights/settings`, async ({ request }) => {
      const body = (await recordRequest(
        requests,
        request
      )) as Partial<LightSettings>
      state.settings = { ...state.settings, ...body }
      return HttpResponse.json(state.settings)
    }),
  ]

  return {
    host,
    baseUrl,
    handlers,
    requests,
    useBadRequest: (method, endpoint) => {
      server.use(
        http[method.toLowerCase() as Lowercase<HttpMethod>](
          `${baseUrl}${endpoint}`,
          () => new HttpResponse(null, { status: 400 })
        )
      )
    },
    useNetworkError: (method, endpoint) => {
      server.use(
        http[method.toLowerCase() as Lowercase<HttpMethod>](
          `${baseUrl}${endpoint}`,
          () => HttpResponse.error()
        )
      )
    },
    getState: () => clone(state),
    setState: (update) => {
      state = {
        ...state,
        ...clone(update),
      }
    },
    reset: () => {
      state = clone(initialState)
      requests.length = 0
    },
  }
}

export { createKeylightMockDevice, setupKeylight, setupKeylightMockServer }
export type { KeylightMockDevice, KeylightMockState, RecordedRequest }
