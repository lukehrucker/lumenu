import { TextAttributes } from '@opentui/core'

interface HelpBarProps {
  shortcuts: string[]
  status?: string
}

export function HelpBar({ shortcuts, status }: HelpBarProps) {
  return (
    <text attributes={TextAttributes.DIM}>
      {shortcuts.join('  ')}
      {status ? `  |  ${status}` : ''}
    </text>
  )
}
