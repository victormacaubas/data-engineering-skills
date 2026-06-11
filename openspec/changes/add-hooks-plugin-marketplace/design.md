## Context

The repo distributes skills and agents by symlinking (or copying) source directories into `~/.claude/skills/` and `~/.claude/agents/`, where Claude Code auto-discovers them. Hooks don't fit that model: a hook only fires when registered in `settings.json` under an event key, and there is no directory Claude Code scans to auto-discover loose hooks.

Two facts shaped this design:

1. **Anthropic discourages programmatic `settings.json` edits.** The `/hooks` menu is read-only and explicitly tells users to "edit the settings JSON directly or ask Claude to make the change." A third-party install script merging JSON into that file works against the grain of the tool.
2. **Claude Code provides a sanctioned distribution path: plugins + marketplaces.** A plugin bundles hooks (and optionally skills/agents/MCP) in `hooks/hooks.json`; enabling the plugin registers its hooks and the user never edits `settings.json`. The hooks.json format is identical to the `settings.json` `hooks` object, so existing hook content ports directly.

The first hook to ship is a macOS desktop notification on the `Notification` event — a pure inline `osascript` command with no companion script.

## Goals / Non-Goals

**Goals:**
- Distribute hooks without any repo tooling reading, writing, or merging `settings.json`.
- Preserve the existing symlink/copy install model for skills and agents, untouched.
- Use Claude Code's native, sanctioned mechanism (marketplace + `/plugin`) so updates and idempotency come for free.
- Establish a `plugins/` layout and a marketplace catalog that scale to future plugins.

**Non-Goals:**
- Modifying `scripts/install*.sh` to install hooks. The install contract stays as-is.
- A `settings.json` JSON-merge installer, backup logic, or schema validator (the discarded "Option B").
- Codex support — Codex has no hook/plugin equivalent.
- Cross-platform notification commands. The `notifications` hook is macOS-specific (`osascript`); portability is a future concern.
- Converting skills/agents to plugins, or submitting to Anthropic's public community marketplace.

## Decisions

### Decision 1: Plugin marketplace over settings.json editing
Distribute hooks as marketplace plugins rather than having a script edit `settings.json`.

- **Why:** It is the path Anthropic sanctions; it never touches the user's sensitive config; idempotency, dedup, and updates are handled by `/plugin` rather than by bespoke bash/Python. It eliminates the three risks of the merge-script approach (broken settings.json, backup litter, schema drift) entirely.
- **Alternatives considered:**
  - *JSON-merge install script ("Option B")* — deterministic and bootstrap-able, but edits `settings.json`, needs `jq`/Python in the install path, and requires backup + dedup + atomic-write + input-validation logic. Rejected: fights the platform and adds a dependency to a pure-bash install contract.
  - *"Ask Claude / use the `update-config` skill"* — zero new code, but not reproducible and can't run on a fresh machine without a live Claude session. Acceptable as a documented fallback, not as the primary path.

### Decision 2: Marketplace install (Route 2) over skills-directory auto-load (Route 1)
Ship hooks through a marketplace catalog the user adds with `/plugin marketplace add`, rather than symlinking plugin-shaped folders into `~/.claude/skills/` to auto-load as `<name>@skills-dir`.

- **Why:** Route 2 is the discoverable, versioned, "official sharing" path. It keeps plugins out of the `skills/` directory (no co-location of skills and plugins), and it keeps hook distribution fully decoupled from `install.sh` — the marketplace is a parallel channel driven by Claude Code, so the install scripts need no changes at all.
- **Trade-off accepted:** This introduces a *second* distribution mechanism in the repo (symlink for skills/agents, marketplace for plugins). The two are cleanly separated and each is the sanctioned path for its artifact type.
- **Alternative considered:** *Route 1 (skills-dir auto-load)* — would reuse the beloved symlink mechanic and need a small `install-hooks.sh`. Rejected for v1 because it co-locates plugins inside `~/.claude/skills/` and couples hooks back into the installer; the marketplace is the cleaner separation. Route 1 remains available later if symlink-style hook install is ever wanted.

### Decision 3: `plugins/` as the source directory (not `hooks/`)
Name the source directory after the installable artifact (a plugin), not after today's only component type (a hook).

- **Why:** The unit Claude Code fetches is a plugin; a hook is one component inside it. `plugins/` matches Anthropic's own `metadata.pluginRoot: "./plugins"` convention, keeps parallel structure with `skills/`/`agents/` (each folder = one artifact type), and stays accurate if a future plugin bundles a skill + a hook.
- **Alternative considered:** `hooks/` — wins only on at-a-glance "where are the hooks," but misnames the folder and would mislead once a plugin carries more than hooks. Discoverability is handled by `docs/hooks.md` and the README instead.

### Decision 4: Marketplace named `data-engineering-skills`, `./`-prefixed plugin sources
The public marketplace identifier matches the repo. Each catalog entry uses a relative `source` that **must start with `./`** (e.g. `"./plugins/notifications"`), resolved relative to the marketplace root (the directory containing `.claude-plugin/`).

- **Why:** Matches the repo name users already know; the public "skills" identity is carried by the marketplace name while the internal `plugins/` folder stays accurate. Relative sources resolve correctly because users add the marketplace via git.
- **Note:** A `metadata.pluginRoot` shorthand (bare `source: "notifications"`) was tried first and rejected — Claude Code does not recognize a bare string lacking the leading `./` as a relative-path source and fails install with "source type your version does not support." The `./`-prefixed form is the canonical one shown throughout Anthropic's docs.

### Decision 5: First plugin is hooks-only and inline
`plugins/notifications/` ships `.claude-plugin/plugin.json` (manifest, `name` required) + `hooks/hooks.json` (a `Notification` handler running an inline `osascript` command). No skills, no agents, no companion script.

- **Why:** A hooks-only plugin is valid and minimal; the inline command needs no `${CLAUDE_PLUGIN_ROOT}` path resolution. The `_`-prefixed metadata from the original hook draft moves into the manifest `description`.

## Risks / Trade-offs

- **Two distribution models in one repo** → Documented explicitly in CLAUDE.md and README so contributors know skills/agents = symlink, plugins = marketplace; never blur them.
- **`plugins/` in a repo named `data-engineering-skills` reads slightly oddly** → The marketplace name carries the public identity; `docs/hooks.md` + README explain the layout.
- **Relative plugin `source` paths only resolve when the marketplace is added via git** → This repo is git-hosted; documented as the supported install method (not raw-URL).
- **`osascript` is macOS-only; the hook silently no-ops or errors elsewhere** → Scope to macOS for v1, note it in `docs/hooks.md` and the plugin description; cross-platform variants are a future plugin concern.
- **Marketplace install has a separate update lifecycle from `git pull`** → Users refresh with `/plugin marketplace update`; documented in the README.

## Migration Plan

Additive only — no migration of existing skills/agents.
1. Add repo-root `.claude-plugin/marketplace.json`.
2. Add `plugins/notifications/` (manifest + hooks.json).
3. Add `docs/hooks.md`; update README and CLAUDE.md.
4. Verify locally with `claude --plugin-dir ./plugins/notifications` and `claude plugin validate`, then via `/plugin marketplace add <local path or git>` + `/plugin install`.

Rollback: delete the new files and revert the README/CLAUDE.md edits. Nothing in the existing install path changed, so skills/agents are unaffected.

## Open Questions

- Should `.claude-plugin/marketplace.json` eventually also list the repo's skills and agents as plugins (full marketplace), or stay hooks/plugins-only? Out of scope here; revisit if the symlink model is ever retired.
- Cross-platform notification support (Linux `notify-send`, etc.) — defer until there's demand.
