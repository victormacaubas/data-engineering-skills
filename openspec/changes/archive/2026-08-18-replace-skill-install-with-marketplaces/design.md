## Context

The repository currently treats `skills/` and `agents/` as sources for a Bash installer that symlinks or copies skills into Claude Code and Codex and agents into Claude Code. See `proposal.md` for the motivation to replace that contract.

Claude Code and Cursor CLI both accept Git-backed plugin marketplaces, but their native marketplace manifests differ. Claude Code uses `.claude-plugin/marketplace.json`; Cursor CLI consumes Cursor's `.cursor-plugin/marketplace.json`. Both can load a plugin whose root contains a single `SKILL.md`. Cursor CLI can also read Claude-compatible agent files, but it does not preserve the tool allowlists, permission modes, skill preloading, or model semantics used by the current agents.

The existing safety contract for scripts is symlink-first installation, timestamped backups for non-repository targets, optional copy mode, and selective installation. Those guarantees remain relevant for agents but no longer for marketplace-managed skills.

## Goals / Non-Goals

**Goals:**

- Keep each `skills/<name>/` directory as the only source of truth for that skill and its supporting files.
- Offer the same release-ready skill set as individual plugins in both Git-backed marketplaces.
- Ensure skill plugins cannot accidentally discover or install the repository's custom agents.
- Give Claude Code and Cursor CLI agents independent, platform-valid definitions.
- Preserve the current agent installer's selection, symlink, copy, backup, and target-override behavior.
- Give existing users an explicit, non-destructive migration path.

**Non-Goals:**

- Supporting Cursor IDE-specific installation flows or publishing in the public Claude Code or Cursor marketplaces.
- Continuing Codex support.
- Distributing custom agents through plugins.
- Making Cursor CLI and Claude Code agent capabilities identical where the platforms expose different controls.
- Automatically deleting legacy skill installations.
- Introducing a generated-agent build system or a new package-manager dependency.

## Decisions

### 1. Maintain two native marketplace catalogs

Add:

```text
.claude-plugin/marketplace.json
.cursor-plugin/marketplace.json
```

Both catalogs use the same marketplace identity and expose the same plugin names, but each follows its platform's native schema. Users register the repository Git URL directly in Claude Code or Cursor CLI. Cursor CLI supports the interactive `/plugin marketplace add <git-url>` flow and the shell command `agent plugin marketplace add <git-url>`.

**Why:** Cursor CLI's support for Git URL marketplaces avoids public-marketplace submission, while native manifests provide the most reliable validation and installation behavior on each platform.

**Alternative considered:** Use only the portable Agent Plugins `plugin.json`. Rejected because that standard defines plugin packaging but not a shared marketplace catalog, and it would not remove the need for platform-specific distribution metadata.

**Alternative considered:** Reuse only Claude Code's marketplace manifest in Cursor CLI. Rejected because Cursor CLI can import some Claude plugin state, but it does not document `.claude-plugin/marketplace.json` as its native multi-plugin contract.

### 2. Point each marketplace entry at one skill directory

Each plugin entry uses the corresponding `skills/<name>/` directory as its source. The directory's root `SKILL.md` becomes the plugin's single skill, and its `scripts/`, `assets/`, and `references/` remain inside the package.

```text
marketplace entry: code-audit
          │
          ▼
skills/code-audit/
├── SKILL.md
├── scripts/
└── references/
```

Catalogs list release-ready immediate children explicitly. They do not list `skills/in-progress/`, `skills/deprecated/`, or a source at repository root.

**Why:** Scoping the plugin source to the skill directory prevents automatic discovery of top-level `agents/`, avoids duplicate skill copies or wrapper directories, and preserves self-contained skill assets.

**Alternative considered:** Treat the whole repository as one plugin and suppress agent discovery in manifest fields. Rejected because the user chose independent skill installation and because empty-component overrides are less robust than structural isolation.

### 3. Derive updates from Git rather than hand-maintained plugin versions

Marketplace entries omit fixed plugin versions unless platform validation requires one. The Git source revision then supplies the update identity, and users obtain changes through their platform's marketplace/plugin update flow.

**Why:** A fixed version per skill would require every skill edit to update two catalogs in lockstep. Git-derived versions keep the skill directory as the only content version source.

**Trade-off:** Marketplace updates are explicit platform operations rather than immediate live updates from repository symlinks.

### 4. Keep complete platform-specific agent files

Restructure agent definitions as:

```text
agents/
├── README.md
├── claude/
│   └── <agent-name>.md
└── cursor/
    └── <agent-name>.md
```

Each platform directory contains complete agent files with the same supported agent-name set. Claude variants retain Claude controls such as tool allowlists, effort, permission mode, and skill preload where valid. Cursor CLI variants use Cursor-supported fields such as `model`, `readonly`, and `is_background`, with prompt adjustments where a Claude-only control cannot be represented.

**Why:** Separate files make safety and model behavior explicit. In particular, read-only workers must use Cursor CLI's `readonly: true` rather than relying on a Claude tool allowlist that Cursor CLI may ignore.

**Alternative considered:** Install the current files into both target directories. Rejected because successful parsing would not imply equivalent permissions or tools.

**Alternative considered:** Generate platform files from shared prompt bodies. Rejected because generated output breaks the simple symlink-first development loop and adds parsing/template complexity to the installer.

### 5. Make scripts agent-only

`scripts/install-agents.sh` becomes the platform-aware implementation helper:

```text
--platform claude|cursor|both
--agents all|none|name[,name...]
--copy
```

It targets `~/.claude/agents/` and `~/.cursor/agents/`, with `CLAUDE_AGENTS_DIR` and `CURSOR_AGENTS_DIR` overrides. When both platforms are selected, the installer validates that every selected name has both variants before changing either target.

`scripts/install.sh` remains the user-facing wizard and non-interactive dispatcher, but it only selects agent platforms, agent names, and install mode. Legacy `--skills` usage fails with marketplace migration guidance.

`scripts/install-claude.sh` and `scripts/install-codex.sh` become temporary failing migration shims rather than skill installers. They explain the new marketplace path; the Codex shim also explains that Codex support ended. This provides a clearer failure for existing automation than deleting the files immediately.

**Why:** This preserves a familiar entry point and backup behavior while making the boundary between marketplace-owned skills and script-owned agents unambiguous.

### 6. Keep migration explicit and non-destructive

Documentation tells existing users to inspect legacy paths before removing repository-owned skill symlinks or copied directories:

```text
~/.claude/skills/<skill-name>
~/.codex/skills/<skill-name>
```

No new script or marketplace operation removes them. Backup files remain untouched. Users install marketplace skills first, verify them, and then remove legacy installations they have identified.

**Why:** The installer cannot reliably distinguish an unchanged copy from a user-customized copy. Automatic cleanup would violate the repository's preservation contract.

### 7. Validate catalogs and installers without new tooling

Verification uses existing shell and standard runtime facilities:

- Parse both marketplace files as JSON.
- Compare their plugin-name sets.
- Confirm every catalog source resolves to one immediate release-ready skill directory with `SKILL.md`.
- Confirm no deprecated or in-progress skill is listed.
- Run Claude Code and Cursor CLI marketplace commands or local plugin loading where available.
- Run `bash -n` on every changed shell script.
- Exercise Claude Code, Cursor CLI, both-platform, subset, copy, backup, invalid-name, and missing-variant cases against temporary target directories.

## Risks / Trade-offs

- **[Git marketplaces require a sufficiently recent Cursor CLI release]** → Document the minimum feature expectation and offer the local-plugin/install-script troubleshooting path only for agent installation, not as a second skill contract.
- **[Two catalogs can drift]** → Compare their entry names and source paths during verification and document that catalog updates are part of graduating a skill.
- **[Separate agent variants can drift semantically]** → Require matching names, document intentional platform differences in `agents/README.md`, and review both variants together.
- **[Claude plugin namespacing changes manual invocation names]** → Document the installed command shown by Claude Code; autonomous skill discovery continues to use the skill description.
- **[Agent-dependent skills can be installed without agents]** → Keep agents out of plugins intentionally and state the separate prerequisite in the affected skill descriptions and onboarding docs.
- **[Legacy skills may appear alongside marketplace skills]** → Provide inspect-first cleanup instructions and explain the duplicate-discovery symptom.
- **[Cursor CLI cannot reproduce every Claude agent restriction]** → Encode the closest supported Cursor CLI behavior, use `readonly` for non-writing agents, and document residual capability differences rather than implying parity.

## Migration Plan

1. Add and validate both marketplace catalogs against the current release-ready skill set.
2. Create Claude Code and Cursor CLI agent source directories and populate matching variants.
3. Convert the agent installer and unified wizard to agent-only, dual-platform behavior while preserving backups and copy mode.
4. Replace the platform skill helpers with explicit migration shims.
5. Update repository guidance and user documentation before advertising the new contract.
6. Test marketplace loading locally and exercise agent installs in temporary directories.
7. Existing users register the appropriate Git marketplace, install and verify desired skills, then manually remove identified legacy skill installations.

Rollback consists of checking out the prior release and re-running its installers. Because this change never deletes legacy skill installations automatically, users who have not cleaned them up can return immediately; users who removed them can reinstall from the prior release.
