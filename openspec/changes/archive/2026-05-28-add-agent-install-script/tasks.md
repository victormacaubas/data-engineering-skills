## 1. Install Script

- [x] 1.1 Create `scripts/install-agents.sh` — symlink/copy agent `.md` files from `agents/` into `~/.claude/agents/`, excluding `README.md`, with backup logic and env var override (`CLAUDE_AGENTS_DIR`)
- [x] 1.2 Update `scripts/install.sh` — add `agents` as a valid `--target` option and include it in the `all` dispatch

## 2. Documentation — Agents Directory

- [x] 2.1 Create `agents/README.md` — table listing each agent with name, model, and description from frontmatter
- [x] 2.2 Create `docs/agents.md` — authoring guide covering file format, frontmatter fields, authoring steps, install instructions, and naming conventions

## 3. Documentation — Repo-Level Updates

- [x] 3.1 Update root `README.md` — add Agents table, update repo structure diagram, add agent install instructions section
- [x] 3.2 Update `CLAUDE.md` — add agent authoring conventions under "How to work here" section

## 4. Verification

- [x] 4.1 Run `bash -n scripts/install-agents.sh` to verify syntax
- [x] 4.2 Run `./scripts/install-agents.sh` and confirm agent is symlinked to `~/.claude/agents/`
- [x] 4.3 Run `./scripts/install.sh --target agents` and confirm dispatch works
