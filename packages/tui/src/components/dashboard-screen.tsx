import * as React from 'react'
import { TextAttributes } from '@opentui/core'
import { useKeyboard, useRenderer } from '@opentui/react'

import type { DeviceRow } from '@lumenu/storage'

interface DashboardScreenProps {
  devices: DeviceRow[]
  onAddDevice: () => void
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

export function DashboardScreen({
  devices,
  onAddDevice,
}: DashboardScreenProps) {
  const renderer = useRenderer()
  const [selectedIndex, setSelectedIndex] = React.useState(0)

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

    if (key.name === 'up' || key.name === 'k') {
      setSelectedIndex((index) => Math.max(0, index - 1))
      return
    }

    if (key.name === 'down' || key.name === 'j') {
      setSelectedIndex((index) => Math.min(devices.length - 1, index + 1))
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <text attributes={TextAttributes.BOLD}>Saved lights</text>
      <text attributes={TextAttributes.DIM}>
        {devices.length} configured {devices.length === 1 ? 'light' : 'lights'}
      </text>

      <box flexDirection="row" flexGrow={1} marginTop={1}>
        <box
          borderStyle="single"
          flexGrow={1}
          flexDirection="column"
          padding={1}
        >
          {devices.map((device, index) => (
            <text
              key={device.serialNumber}
              attributes={
                index === selectedIndex
                  ? TextAttributes.BOLD
                  : TextAttributes.DIM
              }
            >
              {index === selectedIndex ? '>' : ' '} {device.displayName}
            </text>
          ))}
        </box>

        <box
          borderStyle="single"
          flexGrow={2}
          flexDirection="column"
          marginLeft={1}
          padding={1}
        >
          {selectedDevice ? (
            <>
              <text attributes={TextAttributes.BOLD}>
                {selectedDevice.displayName}
              </text>
              <text>Host: {selectedDevice.host}</text>
              <text>Serial: {selectedDevice.serialNumber}</text>
              <text>Product: {formatValue(selectedDevice.productName)}</text>
              <text>
                Firmware: {formatValue(selectedDevice.firmwareVersion)}
              </text>
              <text marginTop={1} attributes={TextAttributes.BOLD}>
                Last known state
              </text>
              <text>Power: {formatPower(selectedDevice.lastOn)}</text>
              <text>
                Brightness: {formatValue(selectedDevice.lastBrightness)}
              </text>
              <text>
                Temperature: {formatValue(selectedDevice.lastTemperature)}
              </text>
              <text>
                Last seen: {formatValue(selectedDevice.lastSeenAt, 'never')}
              </text>
            </>
          ) : (
            <text attributes={TextAttributes.DIM}>No selected light.</text>
          )}
        </box>
      </box>
    </box>
  )
}
