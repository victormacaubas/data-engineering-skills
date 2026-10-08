## Purpose

Define where Claude Code mods live in this repository, how each one is cataloged and installed through the Claude Code marketplace, and the checks that keep the catalog and the mod directories in agreement.

## ADDED Requirements

### Requirement: Mods live under a top-level mods directory
Each release-ready mod SHALL be a kebab-case directory at `mods/<name>/` containing `.claude-plugin/plugin.json`, `hooks/hooks.json`, and the hooks module that file names. A mod that keeps session state SHALL also declare that state in a type contract named by its `plugin.json`.

#### Scenario: Author adds a mod
- **WHEN** an author adds a mod to the repository
- **THEN** it lives at `mods/<name>/`
- **AND** its `plugin.json` `name` equals `<name>`

#### Scenario: Mod passes the engine's validation
- **WHEN** `claude plugin validate mods/<name>` runs
- **THEN** it reports no errors

### Requirement: Each mod is its own Claude Code plugin
The Claude Code catalog SHALL list each release-ready mod as a separate plugin entry whose `source` is `./mods/<name>`, so a user installs or removes one mod without affecting any other mod or skill group.

#### Scenario: User installs one mod
- **WHEN** a user installs one mod plugin from the Claude Code marketplace
- **THEN** only that mod's directory is installed
- **AND** no skill group, custom agent, or other mod is installed with it

#### Scenario: Catalog and mod directories agree
- **WHEN** the catalogs are validated
- **THEN** every directory under `mods/` with a `.claude-plugin/plugin.json` has exactly one Claude catalog entry sourced from it
- **AND** every Claude catalog entry sourced under `mods/` resolves to such a directory

#### Scenario: Plugin names stay unique
- **WHEN** the catalogs are validated
- **THEN** no mod plugin name equals a skill group name or another mod's name

### Requirement: Mods are Claude Code only
Mods SHALL be distributed only through the Claude Code catalog. The Cursor CLI catalog, the Cursor fallback installer, and the Codex installers SHALL NOT list or install mods, and catalog parity between Claude Code and Cursor CLI SHALL apply to skill groups only.

#### Scenario: Cursor catalog is validated
- **WHEN** the Cursor CLI catalog is checked against the Claude Code catalog
- **THEN** it exposes the same skill groups and members
- **AND** it lists no mod, and that difference is not reported as a parity failure

### Requirement: Mod authoring documentation
The repository SHALL document how to author, validate, test, and install a mod, including the directory layout, the catalog entry, and the install command.

#### Scenario: Author reads the mod guide
- **WHEN** an author opens the mod authoring documentation
- **THEN** they find the required files, the `claude plugin validate` and `claude plugin test` commands, the catalog entry shape, and the `/plugin install` step
