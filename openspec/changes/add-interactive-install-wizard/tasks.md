## 1. CLI Contract

- [x] 1.1 Update `scripts/install.sh` usage text to document `--platform`, `--skills`, `--agents`, `--copy`, and help output.
- [x] 1.2 Preserve `--target` as a compatibility alias while routing documentation and examples toward `--platform`.
- [x] 1.3 Add non-TTY detection so no-argument non-interactive invocations fail with a clear command example instead of waiting for input.

## 2. Selection Model

- [x] 2.1 Add discovery logic for valid skill names from `skills/*/SKILL.md`.
- [x] 2.2 Add discovery logic for valid custom-agent names from `agents/*.md`, excluding `README.md`.
- [x] 2.3 Add validation for non-interactive comma-separated skill and custom-agent selections, including `all` and skipped custom agents.
- [x] 2.4 Add reusable interactive numbered-list prompt handling with input validation and re-prompting.

## 3. Interactive Wizard

- [x] 3.1 Add platform selection prompt for Claude Code, Codex, or both.
- [x] 3.2 Add skill selection prompt for all skills or selected skills.
- [x] 3.3 Add custom-agent selection prompt for all agents, selected agents, or skip when Claude Code is selected.
- [x] 3.4 Skip the custom-agent prompt for Codex-only installs and print a short Claude Code-only explanation.
- [x] 3.5 Add install mode prompt for symlink or copy mode.

## 4. Helper Script Filtering

- [x] 4.1 Update `scripts/install-claude.sh` to accept a selected skill list while preserving its no-argument install-all behavior.
- [x] 4.2 Update `scripts/install-codex.sh` to accept a selected skill list while preserving its no-argument install-all behavior.
- [x] 4.3 Update `scripts/install-agents.sh` to accept a selected custom-agent list while preserving its no-argument install-all behavior.
- [x] 4.4 Ensure selective installs do not remove unselected already-installed repo-owned symlinks.
- [x] 4.5 Ensure invalid skill or custom-agent names fail before any install work begins.

## 5. Unified Installer Wiring

- [x] 5.1 Route interactive wizard selections from `scripts/install.sh` to the helper scripts.
- [x] 5.2 Route non-interactive `--platform`, `--skills`, and `--agents` flags from `scripts/install.sh` to the helper scripts.
- [x] 5.3 Reject `--platform codex --agents ...` with a clear custom-agents-are-Claude-only error.
- [x] 5.4 Support the non-interactive install-everything command `./scripts/install.sh --platform both --skills all --agents all`.
- [x] 5.5 For `--platform both`, install selected skills for Claude Code and Codex while installing selected custom agents for Claude Code only.
- [x] 5.6 Print a final summary note when Codex is selected and custom agents are installed only for Claude Code.

## 6. Documentation And Verification

- [x] 6.1 Update `README.md` to present `./scripts/install.sh` as the primary install command and document interactive behavior.
- [x] 6.2 Update `docs/agents.md` and skill install documentation as needed for selective installs.
- [x] 6.3 Run `bash -n` on all install scripts.
- [x] 6.4 Verify non-interactive selective skill installs with temporary Claude Code and Codex target directories.
- [x] 6.5 Verify non-interactive selective custom-agent installs with a temporary Claude Code agents target directory.
- [x] 6.6 Verify invalid selections fail without modifying temporary target directories.
- [x] 6.7 Verify Codex-only installs skip or reject custom-agent selection according to interactive and non-interactive mode.
- [x] 6.8 Verify both-platform installs put selected skills in both target skill directories, selected custom agents only in the Claude Code agents target directory, and print the Codex custom-agent support note.
