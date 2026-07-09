## ADDED Requirements

### Requirement: Two orchestration skills split at mutation target

The session-orchestration workflow SHALL be delivered as two skills whose boundary is drawn at what each is allowed to mutate. `orchestrate-gather` SHALL mutate nothing (read-only: it dispatches read-only workers, reads sources, and reports). `orchestrate-implement` SHALL be the only skill that mutates code and task-tracking artifacts. Each skill SHALL refuse to perform the other's job even when technically capable.

#### Scenario: Gather skill stays read-only

- **WHEN** `orchestrate-gather` runs
- **THEN** it dispatches read-only workers, reads Jira/Confluence/vault/codebase sources, and returns a briefing
- **AND** it writes no files, edits no sources, and ticks no tasks

#### Scenario: Implement skill owns code and tracking mutations

- **WHEN** `orchestrate-implement` runs
- **THEN** it is the skill that dispatches write-workers, and it (not the worker) records task completion
- **AND** it does not perform gather-only read/report work as its purpose

### Requirement: Both skills re-establish state from disk on entry

Each orchestration skill SHALL re-derive the state it needs from durable sources (files on disk, OpenSpec CLI output, source systems) on entry, rather than assuming conversational continuity. This SHALL hold whether the skill is invoked at session start or later, so the skill functions correctly after context compaction.

#### Scenario: Implement skill resolves plan source from disk

- **WHEN** `orchestrate-implement` is invoked
- **THEN** it resolves the plan source from disk — an OpenSpec change directory, a pasted/path-provided plan, or a session-only plan-mode plan — before dispatching
- **AND** it reads that source fresh rather than relying on an earlier in-context summary

#### Scenario: Session-only plan is externalized before dispatch

- **WHEN** the plan exists only in the session (e.g. an approved plan-mode plan not written to any file)
- **THEN** `orchestrate-implement` externalizes it to a scratch file before dispatching the worker
- **AND** the dispatched worker is given a durable, readable plan source rather than session context it cannot see

### Requirement: Pre-flight environment gate before write dispatch

Before dispatching any write-worker, `orchestrate-implement` SHALL complete a pre-flight environment gate covering the actions the worker is forbidden from performing: declaring/installing dependencies in the project lock/config, running `terraform init`, and ensuring validation tooling the worker will invoke is installed. The gate SHALL be a blocking precondition, not an advisory step. The gate's contents SHALL be derived from the worker's forbidden-command list and SHALL carry a documented pointer to keep it in sync with `agents/implementer.md`.

#### Scenario: Dependencies declared before dispatch

- **WHEN** the assigned slice needs a dependency not present in the project's lock/config
- **THEN** `orchestrate-implement` adds it to the lock/config during pre-flight, before dispatch
- **AND** it does not dispatch expecting the worker to add the dependency (the worker is forbidden from doing so)

#### Scenario: Gate stays aligned with worker constraints

- **WHEN** `agents/implementer.md`'s forbidden-command list changes
- **THEN** the pre-flight gate in `orchestrate-implement` is the documented place that must be updated to match
- **AND** the skill records this coupling explicitly

### Requirement: Thin dispatch contracts that complement worker agents

Each skill SHALL carry a dispatch contract that complements, and does not duplicate, the body of the worker agent it dispatches. A dispatch contract SHALL specify: the inputs the orchestrator must supply (matching the worker's stated input contract), the orchestrator-only value-adds the worker cannot self-provide, and which of the worker's return fields gate the orchestrator's next action. It SHALL NOT restate the worker's own method or output template.

#### Scenario: Gather dispatch contract covers explorer and researcher

- **WHEN** `orchestrate-gather` dispatches `codebase-explorer` or `researcher`
- **THEN** the contract supplies the inputs those agents name (target/focus/questions for the explorer; bounded question/constraints for the researcher)
- **AND** it adds orchestrator-only value: decomposition, the shared-context split, pre-globbed exhaustive file lists, and synthesizing cross-agent flows the agents cannot see

#### Scenario: Implement dispatch contract gates on worker return fields

- **WHEN** an `implementer` worker returns its structured report
- **THEN** `orchestrate-implement` reads `Handoff to orchestrator` and `Concurrency notes` first, resolves every `blocking: true` item before re-dispatching, runs any handed-off commands, and then records task completion
- **AND** the contract does not re-teach the worker's own output template

### Requirement: Deciding phase stays as conversation, unnamed by the skills

The workflow's deciding phase (brainstorming, pressure-testing, scoping) SHALL remain plain conversation between the user and the main-session agent. Neither orchestration skill SHALL name, sequence, or drive other decision skills. Each skill SHALL cede the deciding phase and resume only when the conversation yields something concrete to gather for or to implement.

#### Scenario: Skill hands the thinking back to the user

- **WHEN** gather completes and no concrete plan yet exists
- **THEN** `orchestrate-gather` returns its briefing and does not propose a plan or invoke a decision skill
- **AND** control returns to the user for the deciding conversation

### Requirement: CLAUDE.md retains only load-independent invariants

Global CLAUDE.md SHALL retain only the orchestration invariants that must hold regardless of which skill (if any) is loaded — the orchestrator role, never busy-poll, wait on task notifications, and workers never touch task tracking — plus a pointer to the two skills. The per-worker briefing detail SHALL live in the skills, not in always-loaded memory.

#### Scenario: Briefing detail moves out of memory

- **WHEN** the change is applied
- **THEN** the how-to-brief-each-worker detail previously in CLAUDE.md lines 1-29 lives in the skills (heavy implementer detail in a `references/` file)
- **AND** CLAUDE.md contains only the invariants plus a skill pointer
