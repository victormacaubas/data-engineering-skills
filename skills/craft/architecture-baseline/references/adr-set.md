# The ADR Set

Format and stubs for the decisions this baseline produces. Write each ADR during the conversation, not after. Six months on, the reader's question is rarely "what did we choose" — the code answers that — but "did they consider X, and why not." Only an ADR written while X was still on the table can answer it; once the code exists, an ADR tends to become a summary of what's there.

## Format

Nygard format, in `docs/adr/NNNN-short-title.md`. Four sections, numbered sequentially, never renumbered.

```markdown
# 0001. Short imperative title

## Status

Accepted

## Context

The situation that forces a decision. What's true about the project that
makes this a real question rather than an obvious call. Include constraints,
and the alternatives considered with why each lost.

## Decision

What was chosen, stated so a reader can tell whether a given piece of code
complies. If the decision is enforceable, name the check that enforces it.

## Consequences

What this makes easy and what it makes hard. The costs are the valuable
half — anyone can list benefits, and a reader who only sees benefits
assumes the tradeoff wasn't examined.
```

Status moves `Proposed` → `Accepted`, and later `Superseded by 00NN` when something replaces it. Superseded ADRs stay in the repo. Deleting one erases the reasoning that a later reader needs to understand why the current approach isn't the obvious one.

Keep them short. Half a page each is normal; a page is long. If an ADR needs three pages, it's probably two decisions.

## The seven

One per decision. Write the ones you actually decided — if a project genuinely has no persistence, the identity ADR says so in three lines rather than being skipped, so a later reader knows it was considered.

Extra decisions will surface during the conversation. The test for whether one deserves its own ADR: **would a reasonable person implementing a future change make a different choice without knowing this?** If yes, it's an ADR. If it only affects the code being written right now, it's a comment or nothing.

Every ADR gets a row in the index in `docs/ARCHITECTURE.md`, the ones that surface mid-change included. An ADR missing from the index is one a reviewer has no way to know exists.

Every rule an ADR produces gets one home. If a tool can check it, the home is that check, with a comment naming the ADR. If no tool can, it's an entry in `docs/rules.yaml` whose `source` is the ADR. The ADR holds the reasoning and the alternatives; the check or the entry holds the rule. Neither restates the other.

### 0001. Layer map and dependency direction

The table from Decision 1: which packages or crates exist, what each owns, what each may import or depend on.

Record: why this decomposition rather than the obvious alternative (usually flat, or split by technology instead of responsibility). Name the enforcement — e.g., the `Layered architecture` contract in `pyproject.toml`, or workspace crate boundaries in `Cargo.toml` plus any module-direction rules in `docs/rules.yaml` — because a layer map without a named check is a wish and the ADR should be honest about which parts are tool-checked versus review-checked.

Consequences worth stating: what becomes awkward. Every layering has something it makes harder, and naming it prevents the future argument where someone discovers the friction and assumes nobody noticed.

### 0002. Runtime stack and dependencies

The libraries or crates this project depends on, each paired with the package or crate that owns it, and the notable things deliberately excluded.

Record the exclusions with their reasons — that's the half nobody writes and the half that pays off. "No ORM, because the queries are simple and hand-written SQL stays legible" prevents the question being re-litigated by someone who assumes it was never considered. An absent dependency with no recorded reason reads as an oversight.

List dev tooling separately from runtime dependencies, and keep the two lists consistent with each other and with the lockfile: an ADR that adopts a tool another ADR rejects leaves a reader no way to tell which one won. The registry test's YAML parser is dev tooling.

Record also that the set is closed: additions (including new feature flags or build/proc-macro dependencies in Rust) are decisions, not implementation details. This is the ADR that gives a delegated implementer grounds to stop and hand back a task that needs a new library, rather than picking one.

Consequences worth stating: what you gave up by choosing the lighter option. If you took a minimal argument parser over a full CLI framework, or skipped an async runtime, say what you'll miss if requirements grow, so a future contributor knows the tradeoff was priced rather than overlooked.

### 0003. Identity and grain

The grain in one sentence, the natural key, and the re-run behavior.

Record: whether the key is globally unique or unique within a scope, and if scoped, what qualifies it. This is the field most likely to need a breaking change later, so the ADR should be explicit about what was assumed — "we assume session ids are unique across projects" is a claim a future reader can check, and check it they will, usually right after it turns out to be false.

Also record what you chose *not* to key on and why.

### 0004. Seams

The list of injected dependencies, each with its interface (`Protocol` in Python, `trait` in Rust — plus static vs dynamic dispatch and async-trait style where applicable), and the rule that decided membership.

Record the rule, not just the list, because the list grows and the next person needs the criterion rather than an inventory. Note explicitly which candidates were considered and rejected as non-seams — that's what stops the list from expanding on vibes.

Consequences: injection makes the composition root the one place that knows about concrete implementations, which is a feature until the root gets large. Say so.

### 0005. Error taxonomy and translation boundaries

The domain error taxonomy (base exception or error enum), the initial domain errors, and the rule that adapters translate foreign errors at their own boundary.

Record where the mapping to exit codes lives, and the corollary that code under a taxonomy stops raising bare builtins or leaking untyped/driver errors (such as `ValueError`/`RuntimeError` in Python or `anyhow::Error`/`Result<T, String>` from Rust library APIs). This is the decision most likely to erode quietly, so the ADR is worth writing even though it feels obvious while you're writing it.

### 0006. Testing approach

Builders/factories, fakes, how real-infrastructure integration tests are excluded from default runs (and how the integration lane runs), and what tests may assert against.

Record the litmus test — a behavior-preserving change that breaks a test means the test was wrong — because it's a norm rather than a check, and norms only survive if they're written where people look.

### 0007. Toolchain and quality gate

The tools, the single gate command, and what CI runs.

The substance here isn't the tool list — it's the commitment that architectural rules are enforced mechanically rather than by review. Record that principle, because it's the one that makes the difference and it's invisible in the config file.

Record deliberate exceptions too: if strict type-checking or a lint group is relaxed for one package or crate, that exception belongs here with its reason and, ideally, the condition under which it goes away.

Record also that the gate was run and came back green against the declarations the baseline wrote, and that each contract or check was made to fail once on a deliberate violation before it was trusted. An untested contract is a claim, and this is the ADR where the difference is visible.

## One ADR per decision

**No bundling.** A single "architecture" ADR can't be superseded in pieces. When one of seven decisions changes in a year, you want to supersede that one and leave the other six standing, with the history intact for each.
