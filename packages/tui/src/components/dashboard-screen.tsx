import * as React from 'react'
import { TextAttributes } from '@opentui/core'
import { useKeyboard, useRenderer } from '@opentui/react'
import { Effect } from 'effect'

import { Temperature } from '@lumenu/keylight'
import type { DeviceRow } from '@lumenu/storage'

interface DashboardScreenProps {
  devices: DeviceRow[]
  onAddDevice: () => void
}

type CardControl =
  | 'power'
  | 'brightness'
  | 'temperature'
  | 'refresh'
  | 'details'

const controls: CardControl[] = [
  'power',
  'brightness',
  'temperature',
  'refresh',
  'details',
]

const controlLabels: Record<CardControl, string> = {
  power: 'Power',
  brightness: 'Bright',
  temperature: 'Temp',
  refresh: 'Refresh',
  details: 'Details',
}

function formatValue(value: number | string | null, fallback = 'unknown') {
  return value === null ? fallback : String(value)
}

function formatPower(value: number | null) {
  if (value === 1) {
    return 'on'
  }

  if (value === 0) {
    return 'off'
  }

  return 'unknown'
}

function runtimeStatus(device: DeviceRow) {
  return device.lastSeenAt ? 'online' : 'offline'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatTemperature(value: number | null) {
  return value === null ? 'unknown' : `${value}K`
}

function lastTemperatureKelvin(device: DeviceRow) {
  return device.lastTemperature === null
    ? null
    : Effect.runSync(
        Temperature.apiToKelvin(device.lastTemperature).pipe(
          Effect.catchAll(() => Effect.succeed(null))
        )
      )
}

function bar(value: number | null, min: number, max: number, width = 12) {
  if (value === null) {
    return `[${'-'.repeat(width)}]`
  }

  const percent = (clamp(value, min, max) - min) / (max - min)
  const filled = clamp(Math.round(percent * width), 0, width)

  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}

function describeControl(control: CardControl, device: DeviceRow) {
  if (control === 'power') {
    return `${controlLabels[control]} ${formatPower(device.lastOn)}`
  }

  if (control === 'brightness') {
    return `${controlLabels[control]} ${formatValue(device.lastBrightness)}`
  }

  if (control === 'temperature') {
    return `${controlLabels[control]} ${formatTemperature(lastTemperatureKelvin(device))}`
  }

  return controlLabels[control]
}

export function DashboardScreen({
  devices,
  onAddDevice,
}: DashboardScreenProps) {
  const renderer = useRenderer()
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [focusedControlIndex, setFocusedControlIndex] = React.useState(0)
  const [status, setStatus] = React.useState('Cached state shown')

  const selectedDevice = devices[selectedIndex] ?? devices[0]

  React.useEffect(() => {
    setSelectedIndex((index) =>
      Math.min(index, Math.max(0, devices.length - 1))
    )
  }, [devices.length])

  useKeyboard((key) => {
    if (key.name === 'q') {
      renderer.destroy()
      return
    }

    if (key.name === 'a') {
      onAddDevice()
      return
    }

    if (key.name === 'tab') {
      setFocusedControlIndex((index) => (index + 1) % controls.length)
      return
    }

    if (key.name === 'up' || key.name === 'k') {
      setSelectedIndex((index) => Math.max(0, index - 1))
      return
    }

    if (key.name === 'down' || key.name === 'j') {
      setSelectedIndex((index) => Math.min(devices.length - 1, index + 1))
      return
    }

    if (key.name === 'left' || key.name === 'h') {
      setFocusedControlIndex((index) => Math.max(0, index - 1))
      return
    }

    if (key.name === 'right' || key.name === 'l') {
      setFocusedControlIndex((index) =>
        Math.min(controls.length - 1, index + 1)
      )
      return
    }

    if (key.name === 'r') {
      setStatus('Refresh controls are not wired yet')
      return
    }

    if (key.name === 'i') {
      setStatus('Identify controls are not wired yet')
      return
    }

    if (key.name === 'return' || key.name === 'enter') {
      const focusedControl = controls[focusedControlIndex] ?? 'details'
      setStatus(`${controlLabels[focusedControl]} is not wired yet`)
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <text attributes={TextAttributes.BOLD}>Lumenu dashboard</text>
      <text attributes={TextAttributes.DIM}>
        {devices.length} saved {devices.length === 1 ? 'light' : 'lights'} |{' '}
        {status}
      </text>

      <scrollbox flexGrow={1} marginTop={1}>
        <box flexDirection="column">
          {devices.map((device) => {
            const selected = device === selectedDevice
            const online = runtimeStatus(device) === 'online'
            const temperature = lastTemperatureKelvin(device)

            return (
              <box
                key={device.serialNumber}
                borderStyle={selected ? 'double' : 'single'}
                flexDirection="column"
                marginBottom={1}
                padding={1}
              >
                <text
                  attributes={
                    selected ? TextAttributes.BOLD : TextAttributes.DIM
                  }
                >
                  {selected ? '>' : ' '} {device.displayName} |{' '}
                  {runtimeStatus(device)} | {formatPower(device.lastOn)}
                </text>

                <text attributes={online ? undefined : TextAttributes.DIM}>
                  Bright {bar(device.lastBrightness, 0, 100)}{' '}
                  {formatValue(device.lastBrightness)}% | Temp{' '}
                  {bar(temperature, 2900, 7000)}{' '}
                  {formatTemperature(temperature)}
                </text>

                <text attributes={online ? undefined : TextAttributes.DIM}>
                  {controls
                    .map((control, controlIndex) => {
                      const focused =
                        selected && focusedControlIndex === controlIndex
                      const disabled =
                        !online &&
                        (control === 'power' ||
                          control === 'brightness' ||
                          control === 'temperature')
                      const label = describeControl(control, device)
                      const framed = focused ? `<${label}>` : `[${label}]`

                      return disabled ? `${framed} disabled` : framed
                    })
                    .join('  ')}
                </text>

                <text attributes={TextAttributes.DIM}>
                  Host {device.host} | Serial {device.serialNumber} | Last seen{' '}
                  {formatValue(device.lastSeenAt, 'never')}
                </text>
              </box>
            )
          })}
        </box>
      </scrollbox>
    </box>
  )
}
