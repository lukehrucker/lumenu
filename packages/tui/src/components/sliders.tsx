import { TextAttributes } from '@opentui/core'

const partialBlocks = [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const

interface SmoothSliderProps {
  value: number | null
  min: number
  max: number
  width?: number
  selected?: boolean
  disabled?: boolean
  updating?: boolean
  error?: boolean
  activeColor: string
  trackColor?: string
}

interface ValueSliderProps {
  value: number | null
  width?: number
  selected?: boolean
  disabled?: boolean
  updating?: boolean
  error?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sliderSegments(
  value: number | null,
  min: number,
  max: number,
  width: number
) {
  if (value === null || max <= min || width <= 0) {
    return {
      filled: '',
      partial: '',
      empty: '░'.repeat(Math.max(0, width)),
    }
  }

  const percentage = (clamp(value, min, max) - min) / (max - min)
  const cells = percentage * width
  const fullCells = clamp(Math.floor(cells), 0, width)
  const partialIndex = clamp(Math.floor((cells - fullCells) * 8), 0, 7)
  const partial = fullCells < width ? partialBlocks[partialIndex] : ''
  const partialWidth = partial && partial !== ' ' ? 1 : 0
  const emptyWidth = width - fullCells - partialWidth

  return {
    filled: '█'.repeat(fullCells),
    partial: partial === ' ' ? '' : partial,
    empty: '░'.repeat(Math.max(0, emptyWidth)),
  }
}

function formatBrightness(value: number | null) {
  return value === null ? '--' : `${value}%`
}

function formatTemperature(value: number | null) {
  return value === null ? '----' : `${value}K`
}

function temperatureColor(value: number | null) {
  if (value === null) {
    return '#71717a'
  }

  if (value < 3500) {
    return '#fb923c'
  }

  if (value < 5000) {
    return '#fde68a'
  }

  if (value < 6000) {
    return '#bfdbfe'
  }

  return '#60a5fa'
}

export function SmoothSlider({
  value,
  min,
  max,
  width = 12,
  selected = false,
  disabled = false,
  updating = false,
  error = false,
  activeColor,
  trackColor = '#3f3f46',
}: SmoothSliderProps) {
  const segments = sliderSegments(disabled ? null : value, min, max, width)
  const color = disabled ? '#71717a' : activeColor
  const railAttributes = selected ? TextAttributes.BOLD : TextAttributes.DIM

  return (
    <text attributes={disabled ? TextAttributes.DIM : undefined}>
      {selected ? <span attributes={railAttributes}>▐</span> : null}
      <span fg={color}>{segments.filled}</span>
      <span fg={color}>{segments.partial}</span>
      <span fg={trackColor}>{segments.empty}</span>
      {selected ? <span attributes={railAttributes}>▌</span> : null}
      {updating ? <span fg="#a1a1aa">*</span> : null}
      {error ? <span fg="#f87171">!</span> : null}
    </text>
  )
}

export function BrightnessSlider(props: ValueSliderProps) {
  return (
    <box flexDirection="row">
      <text
        width={5}
        attributes={props.selected ? TextAttributes.BOLD : undefined}
      >
        {props.selected
          ? `<${formatBrightness(props.value)}>`
          : formatBrightness(props.value)}
      </text>
      <SmoothSlider {...props} min={0} max={100} activeColor="#facc15" />
    </box>
  )
}

export function TemperatureSlider(props: ValueSliderProps) {
  return (
    <box flexDirection="row">
      <text
        width={7}
        attributes={props.selected ? TextAttributes.BOLD : undefined}
      >
        {props.selected
          ? `<${formatTemperature(props.value)}>`
          : formatTemperature(props.value)}
      </text>
      <SmoothSlider
        {...props}
        min={2900}
        max={7000}
        activeColor={temperatureColor(props.value)}
      />
    </box>
  )
}

export type { SmoothSliderProps, ValueSliderProps }
