import * as React from 'react'
import { TextAttributes } from '@opentui/core'
import { useKeyboard, useRenderer } from '@opentui/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { StatusBadge } from './status-badge.js'
import {
  type DiscoveredDevice,
  discoverHosts,
  identifyHost,
  probeHost,
  saveDiscoveredDevices,
} from '../core/discovery.js'
import { useLumenuRuntime } from '../core/lumenu-runtime.js'

interface OnboardingScreenProps {
  onSaved: () => void
}

export function OnboardingScreen({ onSaved }: OnboardingScreenProps) {
  const runtime = useLumenuRuntime()
  const renderer = useRenderer()
  const queryClient = useQueryClient()
  const [devices, setDevices] = React.useState<DiscoveredDevice[]>([])
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [message, setMessage] = React.useState('Press r to scan for lights.')

  const scan = React.useCallback(async () => {
    setMessage('Scanning for Elgato Key Lights...')
    setDevices([])
    setSelectedIndex(0)

    try {
      const hosts = await runtime.runPromise(discoverHosts())
      setDevices(
        hosts.map((host) => ({
          host,
          status: 'probing' as const,
          selected: false,
        }))
      )

      if (hosts.length === 0) {
        setMessage('No lights found. Press r to scan again.')
        return
      }

      await Promise.all(
        hosts.map(async (host) => {
          try {
            const probed = await runtime.runPromise(probeHost(host))
            setDevices((current) =>
              current.map((device) => (device.host === host ? probed : device))
            )
          } catch (error) {
            setDevices((current) =>
              current.map((device) =>
                device.host === host
                  ? {
                      ...device,
                      status: 'unreachable',
                      error: String(error),
                    }
                  : device
              )
            )
          }
        })
      )

      setMessage('Select lights to save, then press Enter.')
    } catch (error) {
      setMessage(`Discovery failed: ${String(error)}`)
    }
  }, [runtime])

  React.useEffect(() => {
    void scan()
  }, [scan])

  const saveMutation = useMutation({
    mutationFn: () => runtime.runPromise(saveDiscoveredDevices(devices)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
      onSaved()
    },
    onError: (error) => setMessage(`Save failed: ${String(error)}`),
  })

  useKeyboard((key) => {
    if (key.name === 'q') {
      renderer.destroy()
      return
    }

    if (key.name === 'r') {
      void scan()
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

    if (key.name === 'space') {
      const focused = devices[selectedIndex]
      if (!focused?.info?.serialNumber) {
        return
      }

      setDevices((current) =>
        current.map((device, index) =>
          index === selectedIndex
            ? { ...device, selected: !device.selected }
            : device
        )
      )
      return
    }

    if (key.name === 'i') {
      const focused = devices[selectedIndex]
      if (!focused || focused.status !== 'identified') {
        return
      }

      setMessage(`Identifying ${focused.info?.displayName ?? focused.host}...`)
      void runtime
        .runPromise(identifyHost(focused.host))
        .then(() => setMessage('Identify sent.'))
        .catch((error) => setMessage(`Identify failed: ${String(error)}`))
      return
    }

    if (key.name === 'return') {
      if (devices.some((device) => device.selected)) {
        saveMutation.mutate()
      } else {
        setMessage('Select at least one identified light first.')
      }
    }
  })

  return (
    <box flexDirection="column" flexGrow={1}>
      <text attributes={TextAttributes.BOLD}>First-run setup</text>
      <text attributes={TextAttributes.DIM}>
        Discover Key Lights on your local network.
      </text>

      <box flexDirection="column" marginTop={1}>
        {devices.length === 0 ? (
          <text attributes={TextAttributes.DIM}>No discovered lights yet.</text>
        ) : (
          devices.map((device, index) => (
            <text
              key={device.host}
              attributes={
                index === selectedIndex
                  ? TextAttributes.BOLD
                  : TextAttributes.DIM
              }
            >
              {index === selectedIndex ? '>' : ' '}{' '}
              {device.selected ? '[x]' : '[ ]'}{' '}
              <StatusBadge status={device.status} />{' '}
              {device.info?.displayName ?? device.host}{' '}
              <span>{device.host}</span>
            </text>
          ))
        )}
      </box>

      <box marginTop={1}>
        <text attributes={TextAttributes.DIM}>
          {saveMutation.isPending ? 'Saving...' : message}
        </text>
      </box>
    </box>
  )
}
