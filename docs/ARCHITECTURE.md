# Nexus Companion architecture

## Decision — 2026-09-20
Electron + React + TypeScript + Vite. Electron provides mature Windows tray, notifications, global shortcuts, filesystem and NSIS/portable packaging without a Rust toolchain. React owns presentation only. Node services own persistence and integrations behind a narrow context-isolated IPC bridge. SQLite runs in a worker (Node built-in SQLite); no native addon ABI dependency. Windows AppData/Nexus Companion stores data, logs and imported assets. No network calls or analytics at runtime.

## Boundaries
- `src/features`: home, projects, tasks, calendar, agents, timeline, notes, settings, focus.
- `src/domain`: typed entities, calendar recurrence, reports, avatar state, provider contracts.
- `electron/storage`: SQLite worker and asynchronous request client. Parameterized queries, versioned migrations, atomic transactions.
- `electron/providers`: read-only Codex local session adapter. Runtime state is a last-observed event, not proof of a currently running process. Stale/incomplete observations are Unavailable; no fabricated progress, approvals or run controls.
- `electron/services`: safe project opening, read-only Git, asset import, notification scheduling.
- `src/components`: shared controls, command palette, virtualized log list, shell.
- Avatar renderer accepts state-to-asset packs. Local calendar provider supports recurrence independent of future cloud adapters. Widget definitions separate home layout from data.

## Security and privacy
Renderer has no Node access. Sandbox and context isolation enabled. IPC uses allowlisted methods and validates paths and payloads. No arbitrary shell strings. External URLs limited to HTTPS/HTTP. Codex credentials are never read. Logs and project contents stay local. Pack imports allow raster resources only and reject traversal. CSP denies remote content.

## Codex compatibility
Official reference: https://developers.openai.com/zh-Hans/docs/app-server (read 2026-09-20). App-server runtime notifications concern threads loaded in that server; a separately launched server is not assumed to observe the desktop app's live threads. Phase one reads local JSONL session events with explicit observation timestamps and capabilities. Adapter is replaceable by an authenticated app-server connection in a future release.

## Build and validation
Each milestone runs TypeScript/Vite build, service/domain tests and Electron smoke launch. Final integration exercises CRUD persistence, recurrence, drag scheduling, theme, focus and provider limitations. electron-builder creates x64 portable and NSIS installer under dist. Unsigned builds may trigger Windows SmartScreen; production signing needs the owner's certificate.

## Delivered refinements
Electron is pinned to 39.8.10. Codex discovery/parsing runs in its own worker, with bounded tail reads and deduplication by thread ID. Unix seconds, milliseconds and ISO timestamps are normalized before duration calculations. Main-process scheduling continues while the window is hidden. UI pollers refresh on focus without claiming cross-process live control. Role labels and pins are local display metadata, separate from provider identity.

Backups include records and only referenced assets, with SHA-256 validation. Import shows a preview and merges records transactionally after preserving a pre-restore snapshot. Credentials and source Codex session files are never included. Complete automated verification is available through `npm run verify`; release binaries are tested independently from the development entry point.
