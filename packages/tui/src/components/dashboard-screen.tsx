import * as React from 'react'
import { TextAttributes } from '@opentui/core'
import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react'
import { Effect } from 'effect'

import { Temperature } from '@lumenu/keylight'
import type { DeviceRow } from '@lumenu/storage'

import { BrightnessSlider, TemperatureSlider } from './sliders.js'
import { usePowerMutation } from '../core/power-mutation.js'

interface DashboardScreenProps {
  devices: DeviceRow[]
  onAddDevice: () => void
}

type DashboardRow = 'power' | 'brightness' | 'temperature'

const rows: DashboardRow[] = ['power', 'brightness', 'temperature']

const rowLabels: Record<DashboardRow | 'status', string> = {
  power: 'Power',
  brightness: 'Bright',
  temperature: 'Temp',
  status: 'Status',
}

const minColumnWidth = 24
const labelColumnWidth = 14
const columnGapWidth = 4

function formatValue(value: number | string | null, fallback = 'unknown') {
  return value === null ? fallback : String(value)
}

function formatPower(value: number | null) {
  if (value === 1) {
    return 'ON'
  }

  if (value === 0) {
    return 'OFF'
  }

  return '?'
}

function runtimeStatus(device: DeviceRow) {
  return device.lastSeenAt ? 'online' : 'offline'
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sliceLabel(value: string, width: number) {
  return value.length > width ? value.slice(0, Math.max(0, width - 1)) : value
}

function deviceName(device: DeviceRow | undefined) {
  if (!device) {
    return null
  }

  const displayName = device.displayName.trim()
  const productName = device.productName?.trim()

  if (displayName.length > 0) {
    return displayName
  }

  if (productName && device.serialNumber.length >= 4) {
    return `${productName} ${device.serialNumber.slice(-4)}`
  }

  if (productName) {
    return productName
  }

  return device.serialNumber || device.host
}

function columnWidth(devices: DeviceRow[], terminalWidth: number) {
  const usableWidth = Math.max(0, terminalWidth - labelColumnWidth - 10)
  const widestName = devices.reduce((width, device) => {
    return Math.max(width, (deviceName(device) ?? 'Unknown').length)
  }, 0)

  return clamp(
    widestName + columnGapWidth,
    minColumnWidth,
    Math.max(minColumnWidth, usableWidth)
  )
}

function visibleRange(
  selectedIndex: number,
  deviceCount: number,
  terminalWidth: number,
  columnWidth: number
) {
  const usableWidth = Math.max(0, terminalWidth - labelColumnWidth - 10)
  const visibleCount = clamp(
    Math.floor(usableWidth / columnWidth),
    1,
    Math.max(1, deviceCount)
  )
  const start = clamp(
    selectedIndex - visibleCount + 1,
    0,
    Math.max(0, deviceCount - visibleCount)
  )

  return {
    start,
    end: Math.min(deviceCount, start + visibleCount),
    visibleCount,
  }
}

function rowName(row: DashboardRow) {
  if (row === 'brightness') {
    return 'Brightness'
  }

  if (row === 'temperature') {
    return 'Temperature'
  }

  return 'Power'
}

export function DashboardScreen({ devices }: DashboardScreenProps) {
  const renderer = useRenderer()
  const { width } = useTerminalDimensions()
  const [selectedDeviceIndex, setSelectedDeviceIndex] = React.useState(0)
  const [selectedRowIndex, setSelectedRowIndex] = React.useState(1)
  const powerMutation = usePowerMutation()

  const dashboardColumnWidth = columnWidth(devices, width)
  const range = visibleRange(
    selectedDeviceIndex,
    devices.length,
    width,
    dashboardColumnWidth
  )
  const visibleDevices = devices.slice(range.start, range.end)
  const selectedDevice = devices[selectedDeviceIndex] ?? devices[0]
  const selectedRow = rows[selectedRowIndex] ?? 'brightness'
  const narrow = width < 70

  React.useEffect(() => {
    setSelectedDeviceIndex((index) =>
      Math.min(index, Math.max(0, devices.length - 1))
    )
  }, [devices.length])

  useKeyboard((key) => {
    if (key.name === 'q') {
      renderer.destroy()
      return
    }

    if (key.name === 'left' || key.name === 'H') {
      setSelectedDeviceIndex((index) => Math.max(0, index - 1))
      return
    }

    if (key.name === 'right' || key.name === 'L') {
      setSelectedDeviceIndex((index) => Math.min(devices.length - 1, index + 1))
      return
    }

    if (key.name === 'up' || key.name === 'k') {
      setSelectedRowIndex((index) => Math.max(0, index - 1))
      return
    }

    if (key.name === 'down' || key.name === 'j' || key.name === 'tab') {
      setSelectedRowIndex((index) => Math.min(rows.length - 1, index + 1))
      return
    }

    if (key.name === 'space' || key.name === 'return' || key.name === 'enter') {
      if (
        selectedRow === 'power' &&
        selectedDevice &&
        !powerMutation.isPending
      ) {
        powerMutation.mutate(selectedDevice)
        return
      }

      return
    }
  })

  if (narrow) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <text attributes={TextAttributes.BOLD}>Lumenu Faders</text>

        <scrollbox flexGrow={1} marginTop={1}>
          <box flexDirection="column">
            {devices.map((device, index) => {
              const selected = index === selectedDeviceIndex
              const online = runtimeStatus(device) === 'online'
              const temperature = lastTemperatureKelvin(device)

              return (
                <box
                  key={device.serialNumber}
                  flexDirection="column"
                  marginBottom={1}
                >
                  <text
                    attributes={
                      selected ? TextAttributes.BOLD : TextAttributes.DIM
                    }
                  >
                    {selected ? '>' : ' '} {deviceName(device)}{' '}
                    {runtimeStatus(device)} {formatPower(device.lastOn)}
                  </text>
                  <box flexDirection="row">
                    <text
                      width={8}
                      attributes={online ? undefined : TextAttributes.DIM}
                    >
                      {'  '}Bright
                    </text>
                    <BrightnessSlider
                      value={device.lastBrightness}
                      selected={selected && selectedRow === 'brightness'}
                      disabled={!online}
                    />
                  </box>
                  <box flexDirection="row">
                    <text
                      width={8}
                      attributes={online ? undefined : TextAttributes.DIM}
                    >
                      {'  '}Temp
                    </text>
                    <TemperatureSlider
                      value={temperature}
                      selected={selected && selectedRow === 'temperature'}
                      disabled={!online}
                    />
                  </box>
                </box>
              )
            })}
          </box>
        </scrollbox>
      </box>
    )
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="row">
        <text attributes={TextAttributes.BOLD} flexGrow={1}>
          Lumenu Faders
        </text>
        <text attributes={TextAttributes.DIM}>
          {devices.length > range.visibleCount
            ? `Showing lights ${range.start + 1}-${range.end} of ${devices.length}`
            : 'Cached state shown'}
        </text>
      </box>

      <box flexDirection="column" marginTop={1}>
        <box borderStyle="single" flexDirection="column" padding={2}>
          <box flexDirection="row" marginBottom={1}>
            <text width={labelColumnWidth}> </text>
            {visibleDevices.map((device) => {
              const selected = device === selectedDevice

              return (
                <text
                  key={device.serialNumber}
                  width={dashboardColumnWidth}
                  attributes={
                    selected ? TextAttributes.BOLD : TextAttributes.DIM
                  }
                >
                  {sliceLabel(
                    deviceName(device) ?? 'Unknown',
                    dashboardColumnWidth - columnGapWidth
                  )}
                </text>
              )
            })}
          </box>

          <box flexDirection="row" marginBottom={1}>
            <text width={labelColumnWidth}>{rowLabels.power}</text>
            {visibleDevices.map((device) => {
              const selected =
                device === selectedDevice && selectedRow === 'power'

              return (
                <text
                  key={device.serialNumber}
                  width={dashboardColumnWidth}
                  attributes={selected ? TextAttributes.BOLD : undefined}
                >
                  {selected
                    ? `<${formatPower(device.lastOn)}>`
                    : formatPower(device.lastOn)}
                </text>
              )
            })}
          </box>

          <box flexDirection="row" marginBottom={1}>
            <text width={labelColumnWidth}>{rowLabels.brightness}</text>
            {visibleDevices.map((device) => {
              const selected =
                device === selectedDevice && selectedRow === 'brightness'
              const online = runtimeStatus(device) === 'online'

              return (
                <box key={device.serialNumber} width={dashboardColumnWidth}>
                  <BrightnessSlider
                    value={device.lastBrightness}
                    selected={selected}
                    disabled={!online}
                  />
                </box>
              )
            })}
          </box>

          <box flexDirection="row" marginBottom={1}>
            <text width={labelColumnWidth}>{rowLabels.temperature}</text>
            {visibleDevices.map((device) => {
              const selected =
                device === selectedDevice && selectedRow === 'temperature'
              const online = runtimeStatus(device) === 'online'

              return (
                <box key={device.serialNumber} width={dashboardColumnWidth}>
                  <TemperatureSlider
                    value={lastTemperatureKelvin(device)}
                    selected={selected}
                    disabled={!online}
                  />
                </box>
              )
            })}
          </box>

          <box flexDirection="row">
            <text width={labelColumnWidth}>{rowLabels.status}</text>
            {visibleDevices.map((device) => (
              <text key={device.serialNumber} width={dashboardColumnWidth}>
                {runtimeStatus(device)}
              </text>
            ))}
          </box>
        </box>
      </box>

      <text marginTop={1} attributes={TextAttributes.DIM}>
        Selected: {formatValue(deviceName(selectedDevice))} /{' '}
        {rowName(selectedRow)}
      </text>
    </box>
  )
}
