import { Schema } from 'effect'

const Milliseconds = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0)
)

export const PowerState = Schema.transform(
  Schema.Literal(0, 1),
  Schema.Boolean,
  {
    decode: (value) => value === 1,
    encode: (value) => (value ? 1 : 0),
  }
)

export const PowerOnBehavior = Schema.Literal(0, 1)

export const Brightness = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 100)
)

export const ApiTemperature = Schema.Number.pipe(
  Schema.int(),
  Schema.between(143, 344)
)

export const KelvinTemperature = Schema.Number.pipe(
  Schema.int(),
  Schema.between(2900, 7000)
)

export const AccessoryInfo = Schema.mutable(
  Schema.Struct({
    productName: Schema.String,
    hardwareBoardType: Schema.Number.pipe(Schema.int()),
    firmwareBuildNumber: Schema.Number.pipe(Schema.int()),
    firmwareVersion: Schema.String,
    serialNumber: Schema.String,
    displayName: Schema.String,
    features: Schema.mutable(Schema.Array(Schema.String)),
  })
)

export const AccessoryInfoUpdate = Schema.partial(AccessoryInfo)

export const Light = Schema.mutable(
  Schema.Struct({
    on: PowerState,
    brightness: Brightness,
    temperature: ApiTemperature,
  })
)

export const LightUpdate = Schema.partial(Light)

export const LightsStatus = Schema.mutable(
  Schema.Struct({
    numberOfLights: Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(0)
    ),
    lights: Schema.mutable(Schema.Array(Light)),
  })
)

export const LightsUpdate = Schema.mutable(
  Schema.Struct({
    numberOfLights: Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1)
    ),
    lights: Schema.mutable(Schema.Array(LightUpdate).pipe(Schema.minItems(1))),
  })
)

export const LightSettings = Schema.mutable(
  Schema.Struct({
    powerOnBehavior: PowerOnBehavior,
    powerOnBrightness: Brightness,
    powerOnTemperature: ApiTemperature,
    switchOnDurationMs: Milliseconds,
    switchOffDurationMs: Milliseconds,
    colorChangeDurationMs: Milliseconds,
  })
)

export const LightSettingsUpdate = Schema.partial(LightSettings)

export type AccessoryInfo = Schema.Schema.Type<typeof AccessoryInfo>
export type AccessoryInfoUpdate = Schema.Schema.Type<typeof AccessoryInfoUpdate>
export type Light = Schema.Schema.Type<typeof Light>
export type LightUpdate = Schema.Schema.Type<typeof LightUpdate>
export type LightsStatus = Schema.Schema.Type<typeof LightsStatus>
export type LightsUpdate = Schema.Schema.Type<typeof LightsUpdate>
export type LightSettings = Schema.Schema.Type<typeof LightSettings>
export type LightSettingsUpdate = Schema.Schema.Type<typeof LightSettingsUpdate>
