## ADDED Requirements

### Requirement: Marketplace catalog at repository root
The repository SHALL include a `.claude-plugin/marketplace.json` at the repository root that defines a Claude Code plugin marketplace named `data-engineering-skills` and lists every plugin the repo distributes.

#### Scenario: User adds the marketplace
- **WHEN** a user runs `/plugin marketplace add victormacaubas/data-engineering-skills` in Claude Code
- **THEN** Claude Code fetches `.claude-plugin/marketplace.json` from the repository and registers the `data-engineering-skills` marketplace
- **AND** every plugin listed under `plugins` becomes available to install

#### Scenario: Catalog resolves plugin sources relative to the marketplace root
- **WHEN** a plugin entry sets a relative `source` that starts with `./` (e.g. `"./plugins/notifications"`)
- **THEN** the source is resolved relative to the marketplace root (the directory containing `.claude-plugin/`), pointing to `plugins/notifications/`
- **AND** a bare source string without a leading `./` is NOT a valid relative-path source and fails to install

### Requirement: Plugins live under a dedicated plugins directory
The repository SHALL keep all plugin sources under a top-level `plugins/` directory, one subdirectory per plugin, decoupled from the `skills/` and `agents/` directories.

#### Scenario: Plugin directory is self-contained
- **WHEN** a plugin exists at `plugins/<name>/`
- **THEN** it contains a `.claude-plugin/plugin.json` manifest with at least a `name` field
- **AND** any hooks it ships live in `plugins/<name>/hooks/hooks.json`
- **AND** the marketplace catalog references it with a relative `source` beginning with `./` (e.g. `"./plugins/<name>"`)

#### Scenario: Plugin sources are not symlink-installed
- **WHEN** a user runs any `scripts/install*.sh` script
- **THEN** no plugin under `plugins/` is symlinked or copied into a skills or agents directory
- **AND** the install scripts remain unchanged by the existence of `plugins/`

### Requirement: Notifications hook plugin
The repository SHALL provide a hooks-only plugin named `notifications` at `plugins/notifications/` that fires on the Claude Code `Notification` event and triggers a desktop notification.

#### Scenario: Hook configuration shape
- **WHEN** the `notifications` plugin is installed and enabled
- **THEN** `plugins/notifications/hooks/hooks.json` registers a `Notification` event handler whose `hooks` entry is a `command`-type action
- **AND** the command invokes `osascript` to display a desktop notification

#### Scenario: User installs the plugin
- **WHEN** a user has added the `data-engineering-skills` marketplace and runs `/plugin install notifications@data-engineering-skills`
- **THEN** Claude Code installs the plugin and registers its `Notification` hook without the user editing `settings.json`

### Requirement: Hook distribution never edits settings.json
The plugin distribution path SHALL NOT require any script in this repository to read, write, or merge into a user's `settings.json`.

#### Scenario: Installing a hook leaves settings.json untouched by repo tooling
- **WHEN** a user installs a hook plugin from this marketplace
- **THEN** registration is performed by Claude Code's native `/plugin` machinery
- **AND** no repository install script edits `~/.claude/settings.json` or any project `settings.json`

#### Scenario: No new install-time dependency
- **WHEN** the repository's install scripts run
- **THEN** they require no additional runtime tooling (such as `jq` or Python) to distribute hooks
