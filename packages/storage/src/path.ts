import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const appDataDirectory = () => {
  if (process.platform === 'darwin') {
    return join(
      process.env.HOME ?? '.',
      'Library',
      'Application Support',
      'Lumenu'
    )
  }

  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? process.env.USERPROFILE ?? '.', 'Lumenu')
  }

  return join(
    process.env.XDG_DATA_HOME ??
      join(process.env.HOME ?? '.', '.local', 'share'),
    'lumenu'
  )
}

export function getDatabasePath(): string {
  const path =
    process.env.LUMENU_DB_PATH ?? join(appDataDirectory(), 'lumenu.sqlite')
  mkdirSync(dirname(path), { recursive: true })
  return path
}
