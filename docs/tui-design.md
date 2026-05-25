# TUI Design Decisions

This document records the current shared understanding for the Lumenu terminal
UI. It captures product, UX, and architecture decisions made during initial
scoping.

## Goals

- Provide a terminal-first app for discovering, saving, and controlling Elgato
  Key Lights.
- Use mDNS discovery for onboarding and later device additions.
- Persist saved lights locally so the TUI starts quickly after first setup.
- Share persistence with the future desktop app.
- Keep the interface keyboard-first and readable in terminal constraints.

## Repository Context

- `packages/tui` is currently a minimal OpenTUI React app.
- `packages/keylight` already supports identifying a light, fetching accessory
  info, reading light state, updating brightness, updating temperature, toggling
  power, and updating light settings.
- `packages/mdns` currently discovers IPv4 addresses for a service type. It does
  not yet return rich mDNS service metadata.
- OpenTUI provides low-level primitives such as flexbox layout, text, keyboard
  handling, input, select, and scrollbox. Lumenu will need app-level primitives
  for its own UX.

## Persistence

- Saved devices must persist across launches.
- If saved devices exist, the app should open directly to the main dashboard.
- If no saved devices exist, the app should enter onboarding automatically.
- Persistence should live in a new shared package, `@lumenu/storage`.
- `@lumenu/storage` should use SQLite, Drizzle, and Bun's SQLite driver.
- The shared storage package exists so both the TUI and future desktop app use
  the same database and schema.
- The default database path should be an OS app data location, with an
  environment variable override for development and tests.
- The storage package should run migrations automatically during app startup.

## Device Identity

- The canonical saved-device identity should be the Key Light serial number from
  `getAccessoryInfo()`.
- Host/IP address is mutable connection data, not the stable identity.
- Discovery should probe found IPs, fetch accessory info, and upsert by serial
  number.
- If a device lacks a serial number, the app can fall back to a generated local
  ID plus host, but that fallback is less stable.

## Persisted Device Data

- Persist identity and connection metadata.
- Persist the physical device display name.
- Persist model and firmware details when available.
- Persist last-known power, brightness, and temperature.
- Persist timestamps such as creation, update, and last seen.
- Treat persisted state as an offline fallback, not the source of truth when a
  device is reachable.
- Fetch live state on startup, selection, manual refresh, and after control
  updates.

## Onboarding And Discovery

- Discovery should require explicit user confirmation before saving devices.
- The onboarding screen should show a staged probe list with statuses such as:
  - `discovered IP`
  - `probing`
  - `identified`
  - `unreachable`
  - `unsupported`
- For each reachable device, the app should fetch accessory info and current
  light status.
- The user should be able to run identify/flash on a discovered device before
  saving it.
- The user should be able to select which discovered devices to add.
- Saving should persist only the selected devices.
- Discovery should be available both on first run and later from the dashboard as
  an add/rescan flow.
- Later discovery should preserve already saved devices and mark already-saved
  discoveries distinctly.
- Manual add by IP/hostname is out of scope for the first version; mDNS is the
  only add path initially.

## Main Dashboard

- The primary layout should be a single dashboard containing one card per saved
  light.
- Each light card should show high-level status and common inline controls.
- Each light card should use a compact three-row hierarchy:
  - Row 1: display name, reachability, and power state.
  - Row 2: brightness and temperature summary using readable bar-like controls.
  - Row 3: focusable control targets.
- Inline card controls should include power, brightness, temperature, refresh,
  and details.
- Detailed metadata and less-common actions should open in a modal for the
  selected light instead of living in a second dashboard pane.
- The dashboard should remain usable as a single-column card list on narrow
  terminals.
- The dashboard card list should be scrollable from the first implementation;
  moving selection should keep the selected card visible.
- Initial dashboard control scope is per-light control only.
- Each dashboard card should track a runtime status: `loading`, `online`,
  `offline`, or `updating`.
- Multi-light group control, named groups, and preset scenes are out of scope for
  the first version.

## Device Controls

- Common controls should include:
  - Toggle on/off.
  - Brightness.
  - Temperature.
  - Identify/flash.
  - Refresh/retry.
- Brightness and temperature should have focusable slider UI.
- Brightness and temperature should also support shortcut keys for fast
  adjustment.
- Keyboard brightness adjustments should move in 5 percentage point steps.
- Keyboard temperature adjustments should move in 100K steps.
- Slider and shortcut changes should send updates immediately with throttling.
- The UI should use optimistic local state while device requests are in flight.
- Brightness and temperature controls should not require Enter-to-apply edit
  mode; `h`/`l` changes should update the visible value immediately.
- Esc should not undo brightness or temperature changes because updates may have
  already been sent to the device.
- Throttling should prevent flooding the device while preserving a live-control
  feel.

## Failure Handling

- Saved devices should remain visible when offline or unreachable.
- Offline devices should show an error/offline status and dimmed last-known
  state.
- Offline devices should keep refresh and details available, but disable power,
  brightness, and temperature controls until the light is reachable again.
- The user should be able to retry or refresh a saved device.
- The app should not remove saved devices automatically because network/device
  failures can be transient.
- If a saved device's IP changes, the first version should rely on manual rescan
  rather than automatic background rediscovery.

## Device Detail Screen

- There should be a device detail/settings modal opened from a light card.
- The dashboard should keep common controls visible.
- The first detail modal should contain read-only metadata, current/last-known
  state, `Identify`, and `Close`.
- Later detail modal scope can include less-frequent actions and metadata, such
  as:
  - Rename.
  - Forget device.
  - Firmware/model details.
  - Power-on behavior.
  - Fade durations.
  - Exact numeric edits.
- Rename should update the physical device name, not just a local nickname.
- The database should use the physical device display name as the name source,
  without a separate local alias in the first version.

## Navigation

- The TUI should use hybrid arrow-key and Vim-style navigation.
- On the dashboard, `j`/`k` or arrows should move between light cards.
- The dashboard should use a two-level focus model: one selected card, plus one
  focused control within that card.
- Tab should cycle controls within the selected card.
- When brightness or temperature is focused, `h`/`l` should adjust the value.
- Enter should activate or open the selected item.
- Space should toggle selection where applicable.
- Esc should go back or close overlays.
- `?` should open help.
- `q` should quit.
- `r` should refresh/retry where applicable.
- `i` should identify the selected light where applicable.
- A persistent bottom help/status bar should appear on every screen.
- The help/status bar should show context-specific shortcuts and transient status
  or error messages.

## TUI Primitives

Build minimal shared primitives first, not a full component library. Initial
primitives should include:

- `AppShell`
- `HelpBar`
- `SelectableList`
- `Button`
- `Slider`
- `StatusBadge`
- `Modal`
- `TextInputDialog`

These primitives map directly to onboarding, dashboard, detail, and confirmation
flows.

## Screen Model

- Use an explicit route state machine in React state.
- Do not add a router package initially.
- Expected screen states include:
  - `loading-storage`
  - `onboarding`
  - `dashboard`
  - `device-detail`
  - `help`
- Use modal overlays for confirmation, text input, and destructive actions.

## Startup Refresh

- On startup, render saved devices immediately from cached state.
- Refresh live device state in the background.
- Use limited concurrency, such as four devices at a time.
- One offline device should not block the dashboard from becoming usable.

## Deferred Scope

- Manual add by IP/hostname.
- Automatic background rediscovery for changed IP addresses.
- Multi-light selection and group control.
- Named groups.
- Preset scenes.
- A broad reusable TUI design system beyond the minimal primitives listed above.
