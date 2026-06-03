## Context

The repo currently exposes separate install scripts for Claude Code skills, Codex skills, and Claude Code custom agents. The unified `scripts/install.sh` script dispatches to those scripts, but a first-time user still needs to know which target they want and currently gets every eligible skill or agent by default.

The product direction is to make installation feel like one guided setup flow:

```text
scripts/install.sh
  -> choose platform: Claude Code, Codex, or both
  -> choose skills: all or selected subset
  -> choose custom agents: all, selected subset, or skip
  -> choose install mode: symlink or copy
```

Custom agents are currently Claude Code-only because the supported install target is `~/.claude/agents/`. Codex skills can still be installed, but Codex custom-agent installation is out of scope for this change.

When the user chooses both Claude Code and Codex, the installer should treat "both" as "install everything each platform currently supports": selected skills go to both platforms, and selected custom agents go to Claude Code only.

## Goals / Non-Goals

**Goals:**

- Make `scripts/install.sh` the single documented entry point for user setup.
- Run an interactive wizard by default when `scripts/install.sh` is invoked from a terminal without explicit selection flags.
- Support platform selection: Claude Code, Codex, or both.
- Support skill selection: all skills or selected skills.
- Support custom-agent selection when Claude Code is selected.
- Skip or explain the custom-agent step for Codex-only installs.
- Print a final summary note when Codex is selected and custom agents are installed only for Claude Code.
- Keep non-interactive flags available for CI and repeatable automation.
- Preserve existing safety behavior: symlink-first installs, copy mode, and backup before overwriting non-repo paths.

**Non-Goals:**

- Installing Codex custom agents.
- Removing the individual helper scripts immediately.
- Adding a GUI, TUI dependency, or package manager distribution.
- Pruning or uninstalling unselected already-installed skills or agents.

## Decisions

### 1. `scripts/install.sh` becomes the public installer

Users should run one command:

```bash
./scripts/install.sh
```

The existing `install-claude.sh`, `install-codex.sh`, and `install-agents.sh` scripts can remain as implementation helpers. This avoids a large rewrite and preserves the current install logic for symlinking, copying, path overrides, and backups.

**Alternative considered:** Collapse all script logic into `install.sh`. Rejected for now because the helper scripts already isolate platform-specific target directories and behavior.

### 2. Interactive by default only in terminal contexts

When run with no explicit selection flags and stdin is a TTY, `scripts/install.sh` will start the wizard. When non-interactive flags are present, the script will skip prompts and execute directly. If the script is run without flags in a non-TTY context, it should fail with a clear message instead of blocking on input.

**Alternative considered:** Always run the wizard when no flags are passed. Rejected because CI or shell automation could hang.

### 3. Use simple numbered prompts

The wizard should use portable Bash `read` prompts and comma-separated numeric selections instead of depending on `fzf`, `gum`, `dialog`, or another TUI library.

Example:

```text
Which skills should be installed?
  1. All skills
  2. python-engineering-standards
  3. sql-data-analysis
  4. data-governance

Enter numbers separated by commas:
```

**Alternative considered:** Use a richer interactive picker. Rejected because this repository prioritizes portable shell scripts across macOS and Linux.

### 4. Selection is additive, not pruning

Selecting a subset means "install or update these items on this run." It does not remove repo-owned symlinks for items that were previously installed but are not selected this time.

**Alternative considered:** Desired-state install with pruning. Deferred because uninstall behavior is more destructive and needs its own explicit contract.

### 5. Agents install only for Claude Code

If the user selects Claude Code or both platforms, the wizard will ask which custom agents to install. Selected custom agents will be installed into Claude Code only. If Codex is also selected, the final summary will explain that custom agents are currently Claude Code-only, so no custom agents were installed for Codex.

If the user selects Codex only, the wizard will skip the agent selection and print that custom agents are currently Claude Code-only.

**Alternative considered:** Always ask about agents and then ignore them for Codex-only installs. Rejected because it creates confusing choices that cannot be honored.

### 6. Non-interactive flags mirror the wizard

Automation should be able to express the same choices:

```bash
./scripts/install.sh --platform both --skills all --agents all
./scripts/install.sh --platform claude --skills sql-data-analysis,data-governance --agents codebase-explorer
./scripts/install.sh --platform codex --skills all --copy
```

Legacy `--target` can remain as a compatibility alias during this change, but documentation should favor `--platform`.

**Alternative considered:** Interactive-only installer. Rejected because CI and machine bootstrap scripts need deterministic commands.

## Risks / Trade-offs

- [No-arg behavior changes] -> Mitigation: document the change clearly and provide `--platform both --skills all --agents all` for non-interactive "install everything."
- [Prompt parsing mistakes] -> Mitigation: validate input, re-prompt on invalid interactive choices, and fail fast on invalid non-interactive names.
- [Duplicate install logic] -> Mitigation: keep helper scripts responsible for actual installs and add shared selection handling carefully.
- [Codex agent confusion] -> Mitigation: skip the agent picker for Codex-only installs, install selected agents only for Claude Code when both platforms are selected, and print a final summary note.
- [Automation hang] -> Mitigation: detect non-TTY no-flag usage and fail with a clear command example.

## Migration Plan

1. Add selection-aware behavior to the installer scripts while preserving existing install safety.
2. Update documentation to present `scripts/install.sh` as the primary entry point.
3. Keep helper scripts executable and compatible for users who already call them directly.
4. Validate syntax and run install scripts against temporary target directories.

Rollback is straightforward: restore the previous `scripts/install.sh` dispatcher behavior and remove selection flags from documentation.

## Open Questions

- Should `--target` remain indefinitely as an alias, or should it be marked deprecated once `--platform` exists?
- Should the wizard ask about install mode before or after item selection?
- Should the final confirmation print a summary and require approval before installing, or install immediately after valid selections?
