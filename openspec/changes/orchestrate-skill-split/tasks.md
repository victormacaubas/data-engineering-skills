## 1. Rename and reframe orchestrate-gather

- [x] 1.1 Read `agents/codebase-explorer.md` and `agents/researcher.md` in full to ground the read-only dispatch contract in each worker's actual input contract and output template
- [x] 1.2 Read the read-only dispatch guidance in CLAUDE.md lines 1-29 ("Dispatching read-only explorers") as source material to migrate into this skill
- [x] 1.3 Enter plan mode and run `skill-creator` to plan the `context-gather` → `orchestrate-gather` rename + reframe (get user approval before writing per repo rules)
- [x] 1.4 Rename `skills/context-gather/` → `skills/orchestrate-gather/` (preserve git history where possible)
- [x] 1.5 Update the SKILL.md `name` to `orchestrate-gather` and widen the `description` to trigger on mid-decision knowledge gaps, not just session start
- [x] 1.6 Reframe the body from "session-start briefing tool" to on-tap read-only capability (invoked at start OR mid-decide); state that gather mutates nothing
- [x] 1.7 Add a "re-establish state on entry" note so the skill re-reads sources fresh rather than trusting prior context
- [x] 1.8 Fold in the read-only dispatch contract (codebase-explorer + researcher): inputs to supply, orchestrator-only value-adds (decomposition, shared-context split, pre-globbed exhaustive file lists), and which return fields gate next action (Confidence, Assumptions, `blocking: true`)
- [x] 1.9 Confirm the deciding phase is described as plain conversation, naming no decision skills

## 2. Author orchestrate-implement

- [ ] 2.1 Read `agents/implementer.md` in full to ground the write-worker dispatch contract in its input contract, forbidden-command list, and output template (Status / Concurrency notes / Handoff / blocking fields)
- [ ] 2.2 Read the implementer dispatch guidance in CLAUDE.md lines 1-29 ("Dispatching implementer") as source material to migrate into this skill
- [ ] 2.3 Continue in plan mode with `skill-creator` to plan the new `orchestrate-implement` skill (get user approval before writing)
- [ ] 2.4 Create `skills/orchestrate-implement/SKILL.md` with trigger description scoped to the write/implementation phase
- [ ] 2.5 Document plan-source resolution on entry: OpenSpec change dir / pasted path / session-only plan-mode plan, read fresh from disk
- [ ] 2.6 Document externalizing a session-only plan-mode plan to a scratch file (inside the working tree) before dispatch, and resolve the scratch-file naming convention
- [ ] 2.7 Document the pre-flight environment gate as a blocking precondition (deps declared in lock/config first, `terraform init` first, validation libs installed)
- [ ] 2.8 Add a `## Keep in sync` pointer noting the gate mirrors `agents/implementer.md`'s forbidden-command list
- [ ] 2.9 Document the drift check (plan vs current code) and when it is inline vs a bounded explorer dispatch
- [ ] 2.10 Document the dispatch loop: bounded slice, may/must-not-touch files, verification bar; read `Handoff to orchestrator` + `Concurrency notes` first, resolve every `blocking: true` before re-dispatch, then tick tasks
- [ ] 2.11 Create `skills/orchestrate-implement/references/dispatch-implementer.md` with the heavy implementer briefing playbook, pulled in at dispatch time
- [ ] 2.12 Ensure the implement dispatch contract complements (does not duplicate) `implementer.md`'s method/output template

## 3. Trim global memory

- [ ] 3.1 Replace CLAUDE.md lines 1-29 with only the load-independent invariants (orchestrator role, never busy-poll, wait on notifications, workers never touch task tracking)
- [ ] 3.2 Add a pointer line directing to `orchestrate-gather` (gather phase) and `orchestrate-implement` (implement phase)
- [ ] 3.3 Verify no per-worker briefing detail remains in CLAUDE.md (it now lives in the skills)

## 4. Verify and finalize

- [ ] 4.1 Verify install scripts still discover both skills one level deep under `skills/` (no script change expected); run `bash -n` on any script only if touched
- [ ] 4.2 Run `openspec validate orchestrate-skill-split` and resolve any issues
- [ ] 4.3 Manual acceptance walk-through: gather (read-only, on-tap) → conversation → implement (plan resolved from disk, gate passes, dispatch loop) matches the spec scenarios
- [ ] 4.4 Confirm `agents/README.md` and docs need no updates (no agent files changed by this change)
