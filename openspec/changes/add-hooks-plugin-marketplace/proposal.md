## Why

The repo ships skills and agents but has no way to distribute Claude Code **hooks**. Hooks only take effect when registered in `settings.json`, and Anthropic's own `/hooks` UI is deliberately read-only ("edit the settings JSON directly or ask Claude") — a signal that programmatic editing of that user-sovereign file is discouraged. Claude Code provides a sanctioned alternative: distribute hooks as **plugins** via a marketplace, where enabling a plugin registers its hooks and the user never hand-edits `settings.json`. This adds hook distribution without fighting the platform or touching a sensitive file.

## What Changes

- Introduce a **mixed distribution model**: skills and agents keep their existing symlink/copy install via `scripts/install*.sh` (unchanged); hooks ship as marketplace plugins installed through Claude Code's native `/plugin` system.
- Add a repo-root marketplace catalog `.claude-plugin/marketplace.json` named `data-engineering-skills`; each plugin entry uses a relative `source` beginning with `./` (e.g. `"./plugins/notifications"`).
- Add a new top-level `plugins/` directory as the source of truth for plugin-shaped artifacts.
- Add the first plugin, `notifications`, at `plugins/notifications/` — a hooks-only plugin that fires on the `Notification` event and runs an `osascript` desktop notification.
- Add `docs/hooks.md`: an authoring guide for plugins/hooks (plugin layout, marketplace entry, event names, `${CLAUDE_PLUGIN_ROOT}` for future script-backed hooks).
- Update `README.md` with a Hooks section documenting the `/plugin marketplace add` + `/plugin install` flow and the `/plugin marketplace update` refresh.
- Update `CLAUDE.md` with a "Plugin & hook authoring" subsection and a note that hooks are marketplace-distributed, not symlink-installed.
- **Install scripts are NOT modified.** No JSON merging, no `settings.json` editing, no new runtime dependency (`jq`/Python) in the install path.

## Capabilities

### New Capabilities
- `plugin-distribution`: Defines how the repo distributes plugins (and the hooks they bundle) through a Claude Code marketplace — the marketplace catalog, plugin layout, the `notifications` plugin, and the user install/update flow — kept decoupled from the existing skill/agent symlink installers.

### Modified Capabilities
- `repo-scaffold`: The README and CLAUDE.md onboarding requirements expand to cover hooks/plugins — README must document the `/plugin` install flow, and CLAUDE.md must guide plugin authoring and record that hooks are marketplace-distributed.

## Impact

- **New files**: `.claude-plugin/marketplace.json`; `plugins/notifications/.claude-plugin/plugin.json`; `plugins/notifications/hooks/hooks.json`; `docs/hooks.md`.
- **Modified files**: `README.md`, `CLAUDE.md`.
- **Unchanged**: `scripts/install.sh`, `scripts/install-claude.sh`, `scripts/install-codex.sh`, `scripts/install-agents.sh` — the symlink install contract is untouched.
- **New top-level directory**: `plugins/` (and a hidden `.claude-plugin/` at repo root).
- **No new tooling/runtime dependencies.** Distribution is handled by Claude Code's `/plugin` machinery; nothing in this repo executes to install a hook.
- **Platform scope**: Claude Code only. Codex has no hook/plugin equivalent and is unaffected.
- **User-facing**: hooks install via `/plugin marketplace add victormacaubas/data-engineering-skills` then `/plugin install notifications@data-engineering-skills`; the desktop-notification hook is macOS-specific (`osascript`).
