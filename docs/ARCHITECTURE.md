# Nexus Companion architecture

## Current architecture — 0.5.0

Electron + React + TypeScript + Vite. Electron provides Windows tray, notifications, global shortcuts, filesystem and NSIS/portable packaging without a Rust toolchain. React owns presentation only. Node services own persistence and integrations behind a narrow context-isolated IPC bridge. SQLite runs in a worker (Node built-in SQLite); no native addon ABI dependency. Windows AppData/Nexus Companion stores data, logs and imported assets. Ordinary workflows remain local, without analytics or cloud sync. The explicit exception is a user-triggered, read-only account/usage query through the official local Codex CLI, which may contact Codex services.

## Boundaries

- `src/features`: home, projects, tasks, calendar, agents, timeline, notes, settings, focus.
- `src/domain`: typed entities, calendar recurrence, reports, avatar state, provider contracts.
- `electron/storage`: SQLite worker and asynchronous request client. Parameterized queries, JSON records, atomic transactions and backward-compatible optional fields. This release does not require a destructive data migration.
- `electron/providers`: read-only Codex local session adapter. Runtime state is a last-observed event, not proof of a currently running process. Stale/incomplete observations are Unavailable; no fabricated progress, approvals or run controls.
- `electron/services`: safe project opening, read-only Git, asset import, notification scheduling, and the bounded `codex-account.cjs` account/usage query service.
- `src/components`: shared controls, command palette, virtualized log list, shell.
- Avatar renderer accepts state-to-asset packs. Local calendar provider supports recurrence independent of future cloud adapters. Widget definitions separate home layout from data.

## Security and privacy

Renderer has no Node access. Sandbox and context isolation are enabled. IPC uses allowlisted methods and validates paths and payloads. No arbitrary shell strings. External URLs are limited to HTTPS/HTTP. Nexus does not read or persist Codex credentials. The CLI uses its current login for manual queries and may refresh its own OAuth credentials; Nexus neither starts login nor manages those tokens. Thread queries send the selected thread ID to the official service, not Nexus notes, task text or project files. Query results remain in UI memory rather than settings or backups. Pack imports allow raster resources only and reject traversal. Renderer CSP denies remote content.

## Codex compatibility

The local adapter reads JSONL session events with explicit observation timestamps and capabilities. It also normalizes token counters and account-quota snapshots in `electron/providers/usage.cjs`. A card represents a session: `usage.total` is the current session's reported cumulative count, while `usage.lastRequest` describes the latest request, not an entire turn. Repeated cumulative events are not summed. Missing counters remain `null`; cache/reasoning breakdowns are not added again. Forked sessions do not have their source-session counts added to them. Tail-only coverage and missing observation times remain explicit.

`accountQuota` is an independent account snapshot, never a per-task balance. Quota buckets retain their own source, observation time, windows and reset times. The UI clamps the displayed remaining percentage to 0–100 and treats past-reset windows as expired snapshots, without inferring a new balance. It does not infer which account produced historical local records.

The only manual online entry points are `codexQuota` and `codexTaskUsage(threadId)`. The service starts the discovered official CLI with App Server stdio, validates the current account and queries either rate limits or usage for a listed local thread. It bounds runtime/output, closes the helper afterward, and returns a normalized result or a fixed reason code. `NO_TASK_USAGE` means a valid service response did not contain a thread estimate, not zero usage. Results identify the current CLI account, which may differ from the account that created a historical session. Official estimated Credits are displayed as returned; Nexus does not calculate subscription percentage deductions or USD costs.

These requests are initiated only by UI buttons. Local polling, window focus and detail refresh never launch account/usage requests. `useAgents` rejects stale refresh responses and clears manual quota state when the Codex connection changes. Details select the current run by ID; log and task-query request guards prevent delayed responses from appearing in another session.

App Server runtime notifications still do not establish live control over another desktop process's threads. Stop, retry, approvals and model-task execution remain unsupported. General API behavior is documented in the [official App Server reference](https://learn.chatgpt.com/docs/app-server); the distinction between tokens, credits and included limits is described in [official pricing documentation](https://learn.chatgpt.com/docs/pricing). Thread-estimate fields also depend on the installed CLI protocol and the service response.

## Build and validation

The harness runs TypeScript/Vite build, service/domain tests and desktop checks. Release integration includes CRUD persistence, recurrence, drag scheduling, theme, focus, provider limitations and controlled token/quota fixtures. CLI-service tests use fake stdio responses, including missing task estimates and cleanup/error paths; desktop checks use isolated Codex/data directories. Current execution results belong in [VERIFICATION.md](VERIFICATION.md) and [PROJECT_STATUS.md](PROJECT_STATUS.md). electron-builder creates x64 portable and NSIS installer under dist. Unsigned builds may trigger Windows SmartScreen; production signing needs the owner's certificate.

## Delivered refinements

Electron is pinned to 39.8.10. Codex discovery/parsing runs in its own worker, with bounded tail reads and deduplication by thread ID. Unix seconds, milliseconds and ISO timestamps are normalized before duration calculations. Main-process scheduling continues while the window is hidden. UI pollers refresh on focus without claiming cross-process live control. Role labels and pins are local display metadata, separate from provider identity.

Backups include records and only referenced assets, with SHA-256 validation. Import shows a preview and merges records transactionally after preserving a pre-restore snapshot. Credentials and source Codex session files are never included. Complete automated verification is available through `npm run verify`; release binaries are tested independently from the development entry point.
