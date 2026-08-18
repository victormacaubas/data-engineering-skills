## 1. Marketplace Catalogs

- [x] 1.1 Inventory every release-ready immediate `skills/<name>/SKILL.md` directory and record the common plugin-name/source set that both catalogs must expose.
- [x] 1.2 Add `.claude-plugin/marketplace.json` with one Git-installable plugin entry per release-ready skill, sourcing each entry from its own skill directory and excluding fixed versions unless validation requires them.
- [x] 1.3 Add `.cursor-plugin/marketplace.json` with the same plugin-name/source set using the native schema consumed by Cursor CLI.
- [x] 1.4 Parse both catalogs as JSON and verify identical plugin names, valid skill-local sources, no repository-root sources, and no deprecated or in-progress entries.
- [x] 1.5 Register or locally load representative plugins in Claude Code and Cursor CLI, confirming a plugin contains its selected skill and supporting files but no repository custom agents.

## 2. Platform-Specific Agent Definitions

- [x] 2.1 Create `agents/claude/` and move the existing agent definitions into it without changing their Claude Code behavior.
- [x] 2.2 Create matching complete definitions under `agents/cursor/`, translating model settings and frontmatter to Cursor CLI-supported fields and applying `readonly: true` to non-writing agents.
- [x] 2.3 Review prompts that depend on Claude-only tool allowlists, permission modes, or skill preloading and document the intentional Cursor CLI behavior for each unsupported control.
- [x] 2.4 Update `agents/README.md` with every agent's Claude Code and Cursor CLI variants, models, descriptions, and intentional platform differences.
- [x] 2.5 Verify that the Claude Code and Cursor CLI source directories contain identical agent-name sets and that each file's frontmatter name matches its filename.

## 3. Agent-Only Installation Scripts

- [x] 3.1 Update `scripts/install-agents.sh` to accept `--platform claude|cursor|both`, discover variants from the selected platform directories, and honor `CLAUDE_AGENTS_DIR` and `CURSOR_AGENTS_DIR`.
- [x] 3.2 Preserve selective `--agents`, symlink-first installation, `--copy`, timestamped backup behavior, invalid-name reporting, and non-removal of unselected agents for each target.
- [x] 3.3 Add a preflight check that rejects a both-platform installation before mutating either target when any selected agent lacks a platform variant.
- [x] 3.4 Reduce `scripts/install.sh` to an agent-only wizard and dispatcher for platform, agent, and mode selection; make legacy skill options fail with marketplace guidance.
- [x] 3.5 Replace `scripts/install-claude.sh` and `scripts/install-codex.sh` with failing migration shims that explain the Claude marketplace path and the end of Codex support.
- [x] 3.6 Run `bash -n` against every changed shell script.

## 4. Documentation and Repository Guidance

- [x] 4.1 Rewrite `README.md` around Claude Code and Cursor CLI: Git marketplace registration using `/plugin marketplace add` and `agent plugin marketplace add`, individual skill installation and updates, agent installation, target overrides, migration, uninstall, and troubleshooting.
- [x] 4.2 Update `docs/authoring.md` so graduating a skill includes adding matching entries to both marketplace catalogs and validating the skill-local package.
- [x] 4.3 Update `docs/agents.md` for the platform directory layout, supported frontmatter differences, parity expectations, install commands, and verification.
- [x] 4.4 Update `CLAUDE.md` and `AGENT.md` to describe marketplace-managed skills, platform-specific agent definitions, the revised script contract, and removal of Codex support.
- [x] 4.5 Identify agent-dependent skills and document their separate agent-install prerequisites in marketplace descriptions and onboarding material without changing existing `SKILL.md` files unless separately confirmed under the repository's skill-authoring rules.
- [x] 4.6 Remove active Codex setup instructions while retaining clearly labeled legacy-cleanup guidance for existing Codex skill installations.

## 5. End-to-End Verification

- [x] 5.1 Exercise Claude Code-only, Cursor CLI-only, and both-platform all-agent installs against temporary target directories and verify the expected platform variants and symlinks.
- [x] 5.2 Exercise subset, skip, copy, custom-target, invalid-name, missing-variant, and non-interactive cases.
- [x] 5.3 Verify an existing non-repository target is backed up with a timestamp and an existing repository-owned symlink is refreshed without a backup on both platforms.
- [x] 5.4 Verify the unified installer no longer offers skills and that legacy helper scripts and skill flags fail with actionable migration messages.
- [x] 5.5 Re-run catalog parity/source checks, then register or validate the marketplace through Claude Code and Cursor CLI after documentation and source moves.
- [x] 5.6 Run strict OpenSpec validation and review the final diff for accidental Codex support, marketplace agent exposure, or destructive migration behavior.
