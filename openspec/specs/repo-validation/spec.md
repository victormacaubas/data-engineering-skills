# repo-validation Specification

## Purpose

Gives this repository one command that checks its own structural rules, and a project `verify` skill that runs the command before a commit, so that a catalog, skill, agent, or mod defect is found on the machine of the contributor.

## Requirements

### Requirement: One validation command
The repository SHALL provide one validation command. The command SHALL do all the checks of this capability, SHALL print one line for each failure with the file and the rule, and SHALL exit with a non-zero status when a check fails. The command SHALL NOT change a file and SHALL NOT use the network.

#### Scenario: Clean repository
- **WHEN** a contributor runs the command on a repository with no defect
- **THEN** it exits with status zero and states the number of checks that passed

#### Scenario: One defect
- **WHEN** one check fails
- **THEN** the command prints one line with the file and the rule, and exits with a non-zero status

#### Scenario: More than one defect
- **WHEN** three checks fail
- **THEN** the command prints the three failures in one run and does not stop at the first

#### Scenario: Read-only
- **WHEN** the command ends
- **THEN** `git status` shows no file that the command changed

### Requirement: Catalog checks
The validation command SHALL fail when a catalog file is not valid JSON, when the skill-group entries of the Claude Code catalog and the Cursor catalog are different, or when a `skills` array lists a path that does not exist.

#### Scenario: Skill in one catalog only
- **WHEN** a skill is in the `skills` array of the Claude Code catalog and not in the Cursor catalog
- **THEN** the command fails and names the skill and the catalog that does not have it

#### Scenario: Invalid JSON
- **WHEN** a catalog file has a syntax error
- **THEN** the command fails and names the file

#### Scenario: Mod entries do not break parity
- **WHEN** the Claude Code catalog has an entry for a mod and the Cursor catalog does not
- **THEN** the parity check passes

### Requirement: Skill directory checks
The validation command SHALL fail when a skill directory under a group is not in the `skills` array of that group, when a skill name occurs in more than one group, when a cataloged skill has no `SKILL.md`, or when a catalog lists a skill from `in-progress` or `deprecated`.

#### Scenario: Directory is not cataloged
- **WHEN** `skills/craft/new-skill/` exists and no catalog lists it
- **THEN** the command fails and names the directory

#### Scenario: Name in two groups
- **WHEN** the same skill name is in `craft` and in `flow`
- **THEN** the command fails and names the two paths

#### Scenario: In-progress skill is cataloged
- **WHEN** a catalog lists a path under `skills/in-progress/`
- **THEN** the command fails and names the entry

### Requirement: Agent checks
The validation command SHALL fail when an agent does not have the three platform variants, when the `name` of a variant is different from its file name, when a `description` contains the name of a different agent, or when a Claude Code preload does not resolve to a cataloged `<group>:<skill>`.

#### Scenario: Missing variant
- **WHEN** an agent has a Claude Code file and a Cursor file and no Codex file
- **THEN** the command fails and names the missing file

#### Scenario: Description names a different agent
- **WHEN** the `description` of `code-auditor` contains `structure-reviewer`
- **THEN** the command fails and names the file and the agent name that it found

#### Scenario: Preload does not resolve
- **WHEN** a Claude Code agent preloads `craft:missing-skill` and no catalog lists that skill
- **THEN** the command fails and names the agent and the preload

#### Scenario: Preload without a group
- **WHEN** a Claude Code agent preloads a repository skill by its name without the group
- **THEN** the command fails and names the agent and the preload

### Requirement: Mod and script checks
The validation command SHALL fail when a directory under `mods/` has no entry in the Claude Code catalog, when the Cursor catalog lists a mod, when the name of a mod is the name of a skill group or of a different mod, or when a shell script under `scripts/` has a syntax error.

#### Scenario: Mod is not cataloged
- **WHEN** `mods/new-mod/` exists and the Claude Code catalog has no entry for it
- **THEN** the command fails and names the mod

#### Scenario: Mod in the Cursor catalog
- **WHEN** the Cursor catalog lists a mod
- **THEN** the command fails and names the entry

#### Scenario: Shell syntax error
- **WHEN** a script under `scripts/` does not pass `bash -n`
- **THEN** the command fails and names the script

### Requirement: Project verify skill
The repository SHALL provide a project skill named `verify` at `.claude/skills/verify/` that git tracks. The skill SHALL run the validation command. When a change touches a mod, the skill SHALL also run the three mod checks for that mod. The skill SHALL report the output of each command that it ran. The skill SHALL NOT be in a catalog.

#### Scenario: Skill change
- **WHEN** a session that changed a skill invokes `verify`
- **THEN** the validation command runs and its result is reported

#### Scenario: Mod change
- **WHEN** a session that changed `mods/agent-write-guard/` invokes `verify`
- **THEN** the validation command and the three mod checks for that mod run, and each result is reported

#### Scenario: New clone
- **WHEN** a contributor clones the repository
- **THEN** `.claude/skills/verify/SKILL.md` is present, and the other content of `.claude/` stays ignored

#### Scenario: Not a plugin skill
- **WHEN** a user reads the two catalogs
- **THEN** no entry lists the `verify` skill

### Requirement: Contributor guidance names the command
`AGENTS.md` and `docs/authoring.md` SHALL name the validation command as the method to do the structural checks. They SHALL NOT give a manual list as the only method.

#### Scenario: Contributor graduates a skill
- **WHEN** a contributor reads the rules for a new, renamed, or removed skill
- **THEN** the text tells the contributor to run the validation command
