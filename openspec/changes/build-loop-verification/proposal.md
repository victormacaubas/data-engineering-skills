# Proposal

## Why

The build loop has no limit on a failing check. `flow:orchestrate` keeps a disputed task open "until its selector passes", and no worker counts its fix attempts. A later round does not receive the output of the earlier round. A slice can complete on inspection only, and no commit records how the change was verified.

The Anthropic article "How the Claude Code team thinks about verification" (2026-11-16) describes practices that close these gaps. This change applies them to the build loop.

## What Changes

- Add a limit of three fix rounds for each slice in `flow:orchestrate`. After the third round, the orchestrator stops the slice and gives it to the user with the reason.
- Add a limit of three attempts on the same failing check inside `implementer` and `test-author`.
- Add the earlier reports and the last failing output to each re-dispatch brief. Each round writes its own report file.
- Record a slice as `unverified` when no check that exercises the change ran. The option to dispatch without a test bar stays.
- Run the project gate and the command-verified scenarios one time before the build closes.
- Add a `Verified:` trailer to each commit that the orchestrator makes on request. The value is the list of checks that passed, or `none`.
- Copy the "real check" rule from the Claude `implementer` to the Codex and Cursor variants.
- Add a rule that the `implementer` does not change gate configuration to make a check pass. The orchestrator examines the changed paths after each slice.
- Add property-based tests and differential tests to `test-author`. A differential test uses an oracle that the brief names.
- Add a flaky-test rule: no skip, no sleep, no retry until the test passes. The cause is fixed, or the test is deleted and the reason is recorded.
- Add a limit of three review rounds to the closing review.

No change is **BREAKING**. Existing briefs and reports stay valid.

## Capabilities

### New Capabilities

- `build-verification`: how the build loop verifies a slice, limits fix rounds, carries context between rounds, records unverified work, closes a build, and stamps a commit.

### Modified Capabilities

- `test-authoring`: adds requirements for property-based tests, differential tests, and flaky tests. No existing requirement changes.

## Impact

- Edited skill files: `skills/flow/orchestrate/SKILL.md` (Pre-flight, Dispatch loop, Keep the loop moving, Closing the build, Guardrails) and `skills/flow/orchestrate/references/dispatch-implementer.md`, `dispatch-test-author.md`, `dispatch-reviewer.md`.
- Edited agent files: `agents/claude/implementer.md`, `agents/codex/implementer.toml`, `agents/cursor/implementer.md`, `agents/claude/test-author.md`, `agents/codex/test-author.toml`, `agents/cursor/test-author.md`.
- Edited index: `agents/README.md`, only where an intentional platform difference changes.
- New living spec at archive: `openspec/specs/build-verification/spec.md`. Updated living spec: `openspec/specs/test-authoring/spec.md`.
- No change to install scripts, catalogs, or mods.
- Related changes: `standards-verification-rules` puts the same property-test and flaky-test rules in the Python standard. `verification-infrastructure` adds an optional mod rule for gate configuration. This change does not depend on them.
