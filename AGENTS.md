# Agent Guidelines for Lumenu

## Project Overview

**Lumenu** is a monorepo for controlling Elgato Key Lights, containing:

- `packages/keylight` - TypeScript API client library
- `packages/ui` - Desktop GUI (Tauri + React 19 + Vite + Tailwind 4)
- `packages/tui` - Terminal UI (OpenTUI + React)
- `packages/mdns` - mDNS service discovery (stub)

**Stack**: Bun runtime, TypeScript, ES Modules, oxlint/oxfmt, Lefthook

## Build, Lint, Test Commands

### Root Level

```bash
bun install              # Install dependencies
bun run lint             # Lint all packages
bun run lint:fix         # Auto-fix lint issues
bun run format           # Format all files
bun run format:check     # Check formatting
```

### Package-Specific

**keylight (API library):**

```bash
cd packages/keylight
bun test                 # Run all tests
bun test keylight.test.ts  # Run specific test file
bun test --watch         # Watch mode
```

**ui (Desktop app):**

```bash
cd packages/ui
bun run dev              # Start dev server
bun run build            # Type check + build
bun run preview          # Preview production build
bun run tauri dev        # Run Tauri dev mode
bun run tauri build      # Build Tauri app
```

**tui (Terminal app):**

```bash
cd packages/tui
bun run dev              # Run with watch mode
bun run src/index.tsx    # Run once
```

### Running a Single Test

```bash
# From any package with tests
bun test path/to/file.test.ts

# Run specific test by name pattern
bun test --test-name-pattern "ClassName methodName"
```

## Code Style Guidelines

### File & Naming Conventions

| Type              | Convention  | Example                                |
| ----------------- | ----------- | -------------------------------------- |
| Files             | kebab-case  | `http-client.ts`, `keylight.test.ts`   |
| Functions/Methods | camelCase   | `getAccessoryInfo()`, `kelvinToApi()`  |
| Classes           | PascalCase  | `Keylight`, `FetchHttpClient`          |
| Interfaces/Types  | PascalCase  | `HttpClient`, `LightsStatus`           |
| React Components  | PascalCase  | `Button`, `AlertDialog`                |
| Test files        | `*.test.ts` | `keylight.test.ts` (not `.spec.ts`)    |
| Constants         | camelCase   | `const baseUrl`, `const maxBrightness` |

### Import Style

**Always use `.js` extensions** for local imports (even for `.ts` files):

```typescript
// ✅ Correct
import { Keylight } from './keylight.js'
import type { HttpClient } from './http-client.js'

// ❌ Wrong
import { Keylight } from './keylight'
```

**Import order:**

1. Type-only imports from local files
2. Regular imports from local files
3. External library imports

**Path aliases (UI package only):**

```typescript
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
```

### Formatting Rules (oxfmt)

```typescript
// Single quotes, no semicolons
const greeting = 'Hello World'

// 80 character line width
const longString = 'This is a very long string that exceeds 80 characters'

// ES5 trailing commas (objects/arrays, not function params)
const obj = {
  foo: 'bar',
  baz: 'qux',
}

// Always parentheses around arrow function params
const fn = (x) => x * 2

// 2-space indentation
function example() {
  if (condition) {
    doSomething()
  }
}
```

### TypeScript Conventions

**Use interfaces for object shapes:**

```typescript
interface Light {
  on: 0 | 1
  brightness: number
  temperature: number
}
```

**Use type aliases for unions and utility types:**

```typescript
type LightUpdate = Partial<Light>
type Status = 'on' | 'off' | 'unknown'
```

**Strict mode enabled** - respect these settings:

- All `strict` flags are enabled
- `noUncheckedIndexedAccess: true` - array access returns `T | undefined`
- `noFallthroughCasesInSwitch: true`
- `noImplicitOverride: true`

**Export patterns:**

```typescript
// Named exports for utilities/classes
export { Keylight, Temperature }
export type { HttpClient, HttpResponse }

// Default exports only for React pages
export default App
```

### Error Handling

**Create custom error classes:**

```typescript
export class KeylightError extends Error {
  override name = 'KeylightError'

  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, { cause })
  }
}
```

**Error handling pattern:**

```typescript
async function method(value: number): Promise<Result> {
  // 1. Validate inputs first
  if (value < MIN || value > MAX) {
    throw new ValidationError(`Value must be ${MIN}-${MAX}`)
  }

  try {
    // 2. Make request
    const response = await this.httpClient.get<T>(url)

    // 3. Check response
    if (!response.ok) {
      throw new BadRequestError(url, response.status)
    }

    return response.data
  } catch (error) {
    // 4. Rethrow known errors, wrap unknown
    if (error instanceof ValidationError || error instanceof BadRequestError) {
      throw error
    }
    throw new ConnectionError(url, error as Error)
  }
}
```

### Documentation

**Use JSDoc for all public APIs:**

```typescript
/**
 * Set brightness percentage
 * @param brightness Brightness percentage (0-100)
 * @returns Updated light status
 */
async setBrightness(brightness: number): Promise<LightsStatus>

/**
 * Convert Kelvin to API format
 * @param kelvin Temperature in Kelvin (2900-7000)
 * @returns Temperature in API format (143-344)
 * @example
 * Temperature.kelvinToApi(3000) // => 323
 */
static kelvinToApi(kelvin: number): number
```

### Testing Patterns

**Test file structure:**

```typescript
import { describe, test, expect, mock } from 'bun:test'

describe('ClassName', () => {
  // Setup helpers
  const setup = () => {
    const mockDep = createMock()
    const instance = new ClassName(mockDep)
    return { mockDep, instance }
  }

  describe('methodName', () => {
    test('handles success case', async () => {
      const { mockDep, instance } = setup()
      mockDep.method.mockResolvedValue(expectedData)

      const result = await instance.methodName()

      expect(result).toEqual(expected)
      expect(mockDep.method).toHaveBeenCalledWith(expectedArgs)
    })

    test('throws error on invalid input', () => {
      const { instance } = setup()
      expect(() => instance.methodName(-1)).toThrow(ValidationError)
    })
  })
})
```

**Use `describe()` and `test()` blocks** (not `it()`)

**Use dependency injection for testability:**

```typescript
class Keylight {
  constructor(
    private readonly ip: string,
    private readonly httpClient: HttpClient = new FetchHttpClient()
  ) {}
}
```

### React Component Patterns (UI Package)

**Component structure:**

```typescript
import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: 'default' | 'destructive' | 'outline'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], className)}
        data-variant={variant}
        data-size={size}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
```

**Use compound components:**

```typescript
export { Card, CardHeader, CardTitle, CardContent, CardFooter }
```

**Styling with Tailwind:**

- Use utility classes directly in components
- Use `cn()` helper to merge classes: `cn(baseStyles, className)`
- Use `data-*` attributes for variant styling: `data-variant="primary"`
- Never create separate CSS files for components

## Pre-commit Hooks

**Lefthook auto-runs on commit:**

1. `bun run format` - Auto-formats code
2. `bun run lint:fix` - Auto-fixes lint issues
3. Stages fixed files automatically

**To bypass** (not recommended): `git commit --no-verify`

## Important Notes

- **No semicolons** - oxfmt removes them
- **Single quotes** - for all strings
- **`.js` extensions** - required in imports due to `verbatimModuleSyntax`
- **No transpilation** - libraries consumed as TypeScript source
- **Bun test** - not Jest or Vitest
- **ES Modules only** - no CommonJS
- **Strict TypeScript** - respect all strict mode flags
- **No unused variables** - disabled in keylight/tui, enabled in UI package

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `luke-rucker/lumenu`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a single-context layout with root `CONTEXT.md` and root `docs/adr/`. See `docs/agents/domain.md`.
