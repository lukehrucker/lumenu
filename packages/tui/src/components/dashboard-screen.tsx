import * as React from 'react'
import { TextAttributes } from '@opentui/core'
import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react'

import { BrightnessSlider, TemperatureSlider } from './sliders.js'
import {
  lastTemperatureKelvin,
  type LightRecord,
  useSetLightBrightness,
  useSetLightTemperatureKelvin,
  useToggleLightPower,
} from '../core/lights/index.js'

interface DashboardScreenProps {
  lights: LightRecord[]
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
const brightnessStep = 5
const temperatureStep = 100

function formatValue(value: number | string | null, fallback = 'unknown') {
  return value === null ? fallback : String(value)
}

function formatPower(value: boolean | null) {
  if (value === true) {
    return 'ON'
  }

  if (value === false) {
    return 'OFF'
  }

  return '?'
}

function runtimeStatus(light: LightRecord) {
  return light.lastSeenAt ? 'online' : 'offline'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sliceLabel(value: string, width: number) {
  return value.length > width ? value.slice(0, Math.max(0, width - 1)) : value
}

function lightName(light: LightRecord | undefined) {
  if (!light) {
    return null
  }

  const displayName = light.displayName.trim()
  const productName = light.productName?.trim()

  if (displayName.length > 0) {
    return displayName
  }

  if (productName && light.serialNumber.length >= 4) {
    return `${productName} ${light.serialNumber.slice(-4)}`
  }

  if (productName) {
    return productName
  }

  return light.serialNumber || light.host
}

function columnWidth(lights: LightRecord[], terminalWidth: number) {
  const usableWidth = Math.max(0, terminalWidth - labelColumnWidth - 10)
  const widestName = lights.reduce((width, light) => {
    return Math.max(width, (lightName(light) ?? 'Unknown').length)
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

export function DashboardScreen({ lights }: DashboardScreenProps) {
  const renderer = useRenderer()
  const { width } = useTerminalDimensions()
  const [selectedDeviceIndex, setSelectedDeviceIndex] = React.useState(0)
  const [selectedRowIndex, setSelectedRowIndex] = React.useState(1)
  const powerMutation = useToggleLightPower()
  const brightnessMutation = useSetLightBrightness()
  const temperatureMutation = useSetLightTemperatureKelvin()

  const dashboardColumnWidth = columnWidth(lights, width)
  const range = visibleRange(
    selectedDeviceIndex,
    lights.length,
    width,
    dashboardColumnWidth
  )
  const visibleLights = lights.slice(range.start, range.end)
  const selectedLight = lights[selectedDeviceIndex] ?? lights[0]
  const selectedRow = rows[selectedRowIndex] ?? 'brightness'
  const narrow = width < 70

  React.useEffect(() => {
    setSelectedDeviceIndex((index) =>
      Math.min(index, Math.max(0, lights.length - 1))
    )
  }, [lights.length])

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
      setSelectedDeviceIndex((index) => Math.min(lights.length - 1, index + 1))
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
        selectedLight &&
        !powerMutation.isPending
      ) {
        powerMutation.mutate(selectedLight.serialNumber)
        return
      }

      return
    }

    if (key.name === 'h' || key.name === 'l') {
      if (!selectedLight) {
        return
      }

      const direction = key.name === 'h' ? -1 : 1

      if (selectedRow === 'brightness' && !brightnessMutation.isPending) {
        brightnessMutation.mutate({
          serialNumber: selectedLight.serialNumber,
          brightness: clamp(
            (selectedLight.brightness ?? 50) + direction * brightnessStep,
            0,
            100
          ),
        })
        return
      }

      if (selectedRow === 'temperature' && !temperatureMutation.isPending) {
        temperatureMutation.mutate({
          serialNumber: selectedLight.serialNumber,
          kelvin: clamp(
            (lastTemperatureKelvin(selectedLight.temperature) ?? 4000) +
              direction * temperatureStep,
            2900,
            7000
          ),
        })
      }
    }
  })

  if (narrow) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <text attributes={TextAttributes.BOLD}>Lumenu Faders</text>

        <scrollbox flexGrow={1} marginTop={1}>
          <box flexDirection="column">
            {lights.map((light, index) => {
              const selected = index === selectedDeviceIndex
              const online = runtimeStatus(light) === 'online'
              const temperature = lastTemperatureKelvin(light.temperature)

              return (
                <box
                  key={light.serialNumber}
                  flexDirection="column"
                  marginBottom={1}
                >
                  <text
                    attributes={
                      selected ? TextAttributes.BOLD : TextAttributes.DIM
                    }
                  >
                    {selected ? '>' : ' '} {lightName(light)}{' '}
                    {runtimeStatus(light)} {formatPower(light.on)}
                  </text>
                  <box flexDirection="row">
                    <text
                      width={8}
                      attributes={online ? undefined : TextAttributes.DIM}
                    >
                      {'  '}Bright
                    </text>
                    <BrightnessSlider
                      value={light.brightness}
                      selected={selected && selectedRow === 'brightness'}
                      disabled={!online}
                      updating={
                        selected &&
                        selectedRow === 'brightness' &&
                        brightnessMutation.isPending &&
                        brightnessMutation.pendingSerialNumber ===
                          light.serialNumber
                      }
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
                      updating={
                        selected &&
                        selectedRow === 'temperature' &&
                        temperatureMutation.isPending &&
                        temperatureMutation.pendingSerialNumber ===
                          light.serialNumber
                      }
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
          {lights.length > range.visibleCount
            ? `Showing lights ${range.start + 1}-${range.end} of ${lights.length}`
            : 'Cached state shown'}
        </text>
      </box>

      <box flexDirection="column" marginTop={1}>
        <box borderStyle="single" flexDirection="column" padding={2}>
          <box flexDirection="row" marginBottom={1}>
            <text width={labelColumnWidth}> </text>
            {visibleLights.map((light) => {
              const selected = light === selectedLight

              return (
                <text
                  key={light.serialNumber}
                  width={dashboardColumnWidth}
                  attributes={
                    selected ? TextAttributes.BOLD : TextAttributes.DIM
                  }
                >
                  {sliceLabel(
                    lightName(light) ?? 'Unknown',
                    dashboardColumnWidth - columnGapWidth
                  )}
                </text>
              )
            })}
          </box>

          <box flexDirection="row" marginBottom={1}>
            <text width={labelColumnWidth}>{rowLabels.power}</text>
            {visibleLights.map((light) => {
              const selected =
                light === selectedLight && selectedRow === 'power'

              return (
                <text
                  key={light.serialNumber}
                  width={dashboardColumnWidth}
                  attributes={selected ? TextAttributes.BOLD : undefined}
                >
                  {selected
                    ? `<${formatPower(light.on)}>`
                    : formatPower(light.on)}
                </text>
              )
            })}
          </box>

          <box flexDirection="row" marginBottom={1}>
            <text width={labelColumnWidth}>{rowLabels.brightness}</text>
            {visibleLights.map((light) => {
              const selected =
                light === selectedLight && selectedRow === 'brightness'
              const online = runtimeStatus(light) === 'online'

              return (
                <box key={light.serialNumber} width={dashboardColumnWidth}>
                  <BrightnessSlider
                    value={light.brightness}
                    selected={selected}
                    disabled={!online}
                    updating={
                      selected &&
                      brightnessMutation.isPending &&
                      brightnessMutation.pendingSerialNumber ===
                        light.serialNumber
                    }
                  />
                </box>
              )
            })}
          </box>

          <box flexDirection="row" marginBottom={1}>
            <text width={labelColumnWidth}>{rowLabels.temperature}</text>
            {visibleLights.map((light) => {
              const selected =
                light === selectedLight && selectedRow === 'temperature'
              const online = runtimeStatus(light) === 'online'

              return (
                <box key={light.serialNumber} width={dashboardColumnWidth}>
                  <TemperatureSlider
                    value={lastTemperatureKelvin(light.temperature)}
                    selected={selected}
                    disabled={!online}
                    updating={
                      selected &&
                      temperatureMutation.isPending &&
                      temperatureMutation.pendingSerialNumber ===
                        light.serialNumber
                    }
                  />
                </box>
              )
            })}
          </box>

          <box flexDirection="row">
            <text width={labelColumnWidth}>{rowLabels.status}</text>
            {visibleLights.map((light) => (
              <text key={light.serialNumber} width={dashboardColumnWidth}>
                {runtimeStatus(light)}
              </text>
            ))}
          </box>
        </box>
      </box>

      <text marginTop={1} attributes={TextAttributes.DIM}>
        Selected: {formatValue(lightName(selectedLight))} /{' '}
        {rowName(selectedRow)}
      </text>
    </box>
  )
}
