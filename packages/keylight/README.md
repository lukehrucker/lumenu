# @lumenu/keylight

TypeScript client for controlling Elgato Key Light and Key Light Air devices.
All fallible operations return `Effect`.

## Installation

```bash
bun add @lumenu/keylight
```

## Features

- 🔌 Full API coverage for Elgato Key Light
- 🧪 Deeply testable with dependency injection
- 📝 Complete TypeScript types
- ✅ Schema-backed request/response validation
- 🎯 Ergonomic convenience methods
- 🚦 Typed error handling
- 🔁 Boolean public power state with `0 | 1` wire encoding handled internally

## Usage

### Basic Usage

```typescript
import { Effect } from 'effect'
import { Keylight } from '@lumenu/keylight'

// Create a client (use your Key Light's IP address)
const keylight = Keylight.make('192.168.1.61')

// Turn on the light
await Effect.runPromise(keylight.turnOn())

// Set brightness to 50%
await Effect.runPromise(keylight.setBrightness(50))

// Set color temperature to 4000K
await Effect.runPromise(keylight.setTemperatureKelvin(4000))

// Turn off
await Effect.runPromise(keylight.turnOff())
```

### Advanced Usage

```typescript
import { Effect } from 'effect'
import { Keylight } from '@lumenu/keylight'

const keylight = Keylight.make('192.168.1.61')

// Get current status
const status = await Effect.runPromise(keylight.getLights())
console.log(status)
// {
//   numberOfLights: 1,
//   lights: [{ on: true, brightness: 50, temperature: 240 }]
// }

// Update multiple properties at once
await Effect.runPromise(
  keylight.setLight({
    on: true,
    brightness: 75,
    temperature: 250,
  })
)

// Get device information
const info = await Effect.runPromise(keylight.getAccessoryInfo())
console.log(info.displayName, info.firmwareVersion)

// Update device name
await Effect.runPromise(
  keylight.updateAccessoryInfo({
    displayName: 'My Studio Light',
  })
)

// Get and update settings
const settings = await Effect.runPromise(keylight.getSettings())
await Effect.runPromise(
  keylight.updateSettings({
    powerOnBehavior: 1,
    powerOnBrightness: 20,
  })
)

// Identify device (flashes the light)
await Effect.runPromise(keylight.identify())
```

### Effect Service Usage

For application code that already composes services with Effect layers, use
`KeylightClient`.

```typescript
import { Effect } from 'effect'
import { KeylightClient } from '@lumenu/keylight'

const program = Effect.gen(function* () {
  const keylight = yield* KeylightClient
  return yield* keylight.getLights('192.168.1.61')
})

const status = await Effect.runPromise(
  program.pipe(Effect.provide(KeylightClient.layer))
)
```

The host-bound `Keylight.make(host)` facade uses the same implementation under
the hood.

### Temperature Conversion

The Key Light uses a custom temperature format internally. Temperature helpers
also return `Effect`, so validation failures stay in the typed error channel.

```typescript
import { Effect } from 'effect'
import { Temperature } from '@lumenu/keylight'

// Convert Kelvin to API format
const apiTemp = await Effect.runPromise(Temperature.kelvinToApi(4000)) // 240

// Convert API format to Kelvin
const kelvin = await Effect.runPromise(Temperature.apiToKelvin(240)) // 4000
```

## API Reference

### Constructor

```typescript
Keylight.make(host: string)
new Keylight(host: string)
```

- `host` - IP address or hostname of your Key Light device

### Data Model

The TypeScript API represents light power as a boolean:

```typescript
type Light = {
  on: boolean
  brightness: number
  temperature: number
}

type LightUpdate = {
  on?: boolean
  brightness?: number
  temperature?: number
}
```

The physical device still speaks `0 | 1`; the package decodes responses to
`boolean` and encodes updates back to `0 | 1` at the generated-client boundary.

### Methods

#### Control Methods

- `turnOn()` - Turn on the light
- `turnOff()` - Turn off the light
- `setBrightness(brightness: number)` - Set brightness (0-100)
- `setTemperatureKelvin(kelvin: number)` - Set temperature in Kelvin (2900-7000)
- `setTemperature(temperature: number)` - Set temperature in API format (143-344)
- `setLight(options: LightUpdate)` - Set multiple properties at once
- `setLights(light: LightUpdate)` - Update the first light

#### Core API Methods

- `getLights()` - Get current light status
- `updateLights(lights: LightsUpdate)` - Update light status
- `getAccessoryInfo()` - Get device information
- `updateAccessoryInfo(info: AccessoryInfoUpdate)` - Update device information
- `getSettings()` - Get device settings
- `updateSettings(settings: LightSettingsUpdate)` - Update device settings
- `identify()` - Flash the light to identify the device

### Error Handling

The client returns typed Effect errors for better error handling:

```typescript
import { Effect } from 'effect'
import {
  KeylightBadRequestError,
  KeylightConnectionError,
  KeylightDecodeError,
  KeylightHttpError,
  KeylightValidationError,
} from '@lumenu/keylight'

const error = await Effect.runPromise(
  keylight.setBrightness(150).pipe(Effect.flip)
)

if (error instanceof KeylightValidationError) {
  console.error(`Validation error: ${error.message}`)
  console.error(`Field: ${error.field}, Value: ${error.value}`)
} else if (error instanceof KeylightConnectionError) {
  console.error(`Connection failed: ${error.message}`)
} else if (error instanceof KeylightBadRequestError) {
  console.error(`Bad request to ${error.endpoint}`)
} else if (error instanceof KeylightHttpError) {
  console.error(`HTTP ${error.status} from ${error.endpoint}`)
} else if (error instanceof KeylightDecodeError) {
  console.error(`Invalid response from ${error.endpoint}`)
}
```

## Testing

The client uses native `fetch`, so tests can intercept requests with Mock
Service Worker. Public code uses boolean `on`; intercepted wire payloads still
use `0 | 1`.

```typescript
import { Effect } from 'effect'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { Keylight } from '@lumenu/keylight'

const server = setupServer(
  http.put('http://192.168.1.61:9123/elgato/lights', () =>
    HttpResponse.json({
      numberOfLights: 1,
      lights: [{ on: 1, brightness: 50, temperature: 240 }],
    })
  )
)

server.listen()

const keylight = Keylight.make('192.168.1.61')
await Effect.runPromise(keylight.setLight({ on: true }))
server.close()
```

Run the tests:

```bash
bun test
```

## API Documentation

For complete API documentation, see [API_REFERENCE.md](./API_REFERENCE.md).

## License

MIT
