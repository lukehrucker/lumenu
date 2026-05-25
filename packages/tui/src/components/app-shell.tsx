import type * as React from 'react'

interface AppShellProps {
  children: React.ReactNode
  help: React.ReactNode
}

export function AppShell({ children, help }: AppShellProps) {
  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexDirection="column" flexGrow={1} padding={1}>
        {children}
      </box>
      <box borderStyle="single" paddingLeft={1} paddingRight={1}>
        {help}
      </box>
    </box>
  )
}
