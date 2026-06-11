## 1. Notifications plugin

- [] 1.1 Create `plugins/notifications/.claude-plugin/plugin.json` with `name: "notifications"`, a `version`, a `description` (carry over the intent from the original hook draft: desktop notification when Claude needs attention), and `author`.
- [] 1.2 Create `plugins/notifications/hooks/hooks.json` with a `Notification` event handler: `matcher: ""` and a `command`-type hook running `osascript -e 'display notification "Claude Code needs your attention" with title "Claude Code"'`.

## 2. Marketplace catalog

- [] 2.1 Create `.claude-plugin/marketplace.json` at the repo root with `name: "data-engineering-skills"` and an `owner` block.
- [] 2.2 Add the `notifications` plugin entry to the catalog's `plugins` array using a relative `source` that starts with `./` (`"./plugins/notifications"`), with a `description`.

## 3. Local verification

- [] 3.1 Run `claude plugin validate ./plugins/notifications` (or the documented equivalent) and confirm the plugin passes.
- [ ] 3.2 Smoke-test by loading the plugin directly: `claude --plugin-dir ./plugins/notifications`, trigger a `Notification` event, and confirm the macOS desktop notification fires.
- [ ] 3.3 Verify the marketplace resolves: add it from the local path and confirm `notifications@data-engineering-skills` appears installable.

## 4. Documentation

- [] 4.1 Create `docs/hooks.md`: explain the plugin/marketplace model, the `plugins/<name>/` layout (manifest + `hooks/hooks.json`), valid hook event names, `${CLAUDE_PLUGIN_ROOT}` for future script-backed hooks, the macOS-only caveat for `osascript`, and how to add a new plugin to the marketplace catalog.
- [] 4.2 Update `README.md` with a Hooks section: note hooks are marketplace-distributed (not symlinked), give the install flow (`/plugin marketplace add victormacaubas/data-engineering-skills` → `/plugin install notifications@data-engineering-skills`), and the `/plugin marketplace update` refresh.
- [] 4.3 Update `CLAUDE.md` with a "Plugin & hook authoring" subsection: author hooks as plugins under `plugins/<name>/`, list them in `.claude-plugin/marketplace.json`, and record that hooks are marketplace-distributed and the install scripts must NOT be modified to install hooks.

## 5. Final checks

- [] 5.1 Confirm no `scripts/install*.sh` file was modified by this change (`git diff --stat scripts/`).
- [] 5.2 Confirm the new top-level `plugins/` directory and repo-root `.claude-plugin/` exist and that the install scripts ignore them (a dry run of `install.sh` does not pick up `plugins/`).
