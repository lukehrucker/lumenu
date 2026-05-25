import { TextAttributes } from '@opentui/core'

export function CenteredMessage({
  title,
  message,
  dim = true,
}: {
  title: string
  message: string
  dim?: boolean
}) {
  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box justifyContent="center" alignItems="center">
        <ascii-font font="tiny" text={title} />
        <text attributes={dim ? TextAttributes.DIM : undefined}>{message}</text>
      </box>
    </box>
  )
}
