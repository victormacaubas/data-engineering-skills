## 1. Repository Foundation

- [x] 1.1 Update `.gitignore` with OS files, editor files, and build artifact exclusions
- [x] 1.2 Update `skills/` directory with a `.gitkeep` placeholder
- [x] 1.3 Create `scripts/` directory
- [x] 1.4 Create `docs/` directory

## 2. Install Scripts

- [x] 2.1 Create `scripts/install-claude.sh` — symlinks skills into Claude Code skills directory with backup safety, env var override (`CLAUDE_SKILLS_DIR`), and `--copy` flag support
- [x] 2.2 Create `scripts/install-codex.sh` — symlinks skills into Codex skills directory with backup safety, env var override (`CODEX_SKILLS_DIR`), and `--copy` flag support
- [x] 2.3 Create `scripts/install.sh` — unified dispatcher that accepts `--target` flag (`claude`, `codex`, `all`) and delegates to agent-specific scripts
- [x] 2.4 Verify all install scripts pass `bash -n` syntax check and are executable

## 3. Documentation

- [x] 3.1 Create `README.md` with repo purpose, structure, installation instructions (Codex + Claude Code), authoring guide, update/uninstall, and troubleshooting
- [x] 3.2 Create `CLAUDE.md` with repo-specific guidance for Claude Code: how to work in this repo, preserving user changes, skill authoring conventions, and OpenSpec usage
- [x] 3.3 Create `docs/authoring.md` with step-by-step instructions for creating a new skill (directory structure, SKILL.md format, testing locally)

## 4. Verification

- [x] 4.1 Run `bash -n` on all shell scripts to verify syntax
- [x] 4.2 Confirm directory structure matches the design (skills/, scripts/, docs/, openspec/)
- [x] 4.3 Verify install scripts handle the "no skills found" case gracefully
