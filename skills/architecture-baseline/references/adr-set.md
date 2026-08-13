# The ADR Set

Format and stubs for the decisions this baseline produces. Read this while running the conversation, not after — an ADR written during the discussion captures the alternatives while they're still live, and the alternatives are the part that makes it useful later.

An ADR reconstructed at the end records *what* was decided and loses *what else was on the table*. Six months on, the reader's question is almost never "what did we choose" — the code answers that. It's "did they consider X, and why not." A reconstruction can't answer that honestly, because by then X has been forgotten.

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

### 0001. Layer map and dependency direction

The table from Decision 1: which packages exist, what each owns, what each may import.

Record: why this decomposition rather than the obvious alternative (usually flat, or split by technology instead of responsibility). Name the enforcement — "checked by the `Layered architecture` contract in `pyproject.toml`" — because a layer map without a named check is a wish and the ADR should be honest about which it is.

Consequences worth stating: what becomes awkward. Every layering has something it makes harder, and naming it prevents the future argument where someone discovers the friction and assumes nobody noticed.

### 0002. Runtime stack and dependencies

The libraries this project depends on, each paired with the package that owns it, and the notable things deliberately excluded.

Record the exclusions with their reasons — that's the half nobody writes and the half that pays off. "No ORM, because the queries are simple and hand-written SQL stays legible" prevents the question being re-litigated by someone who assumes it was never considered. An absent dependency with no recorded reason reads as an oversight.

Record also that the set is closed: additions are decisions, not implementation details. This is the ADR that gives a delegated implementer grounds to stop and hand back a task that needs a new library, rather than picking one.

Consequences worth stating: what you gave up by choosing the lighter option. If you took `argparse` over `click`, say what you'll miss when the command surface grows, so the future person adding the fifth subcommand knows the tradeoff was priced rather than overlooked.

### 0003. Identity and grain

The grain in one sentence, the natural key, and the re-run behavior.

Record: whether the key is globally unique or unique within a scope, and if scoped, what qualifies it. This is the field most likely to need a breaking change later, so the ADR should be explicit about what was assumed — "we assume session ids are unique across projects" is a claim a future reader can check, and check it they will, usually right after it turns out to be false.

Also record what you chose *not* to key on and why.

### 0004. Seams

The list of injected dependencies, each with its Protocol, and the rule that decided membership.

Record the rule, not just the list, because the list grows and the next person needs the criterion rather than an inventory. Note explicitly which candidates were considered and rejected as non-seams — that's what stops the list from expanding on vibes.

Consequences: injection makes the composition root the one place that knows about concrete implementations, which is a feature until the root gets large. Say so.

### 0005. Error taxonomy and translation boundaries

The base exception, the initial domain errors, and the rule that packages translate foreign exceptions at their own boundary.

Record where the mapping to exit codes lives, and the corollary that code inside a package with a taxonomy doesn't raise bare builtins. This is the decision most likely to erode quietly, so the ADR is worth writing even though it feels obvious while you're writing it.

### 0006. Testing approach

Factories, fakes, the integration marker, and what tests may assert against.

Record the litmus test — a behavior-preserving change that breaks a test means the test was wrong — because it's a norm rather than a check, and norms only survive if they're written where people look.

### 0007. Toolchain and quality gate

The tools, the single gate command, and what CI runs.

The substance here isn't the tool list — it's the commitment that architectural rules are enforced mechanically rather than by review. Record that principle, because it's the one that makes the difference and it's invisible in the config file.

Record deliberate exceptions too: if mypy is strict everywhere except one package, that exception belongs here with its reason and, ideally, the condition under which it goes away.

Record also that the gate was run and came back green against the declarations the baseline wrote. An untested contract is a claim, and this is the ADR where the difference is visible.

## Two habits that keep the set useful

**Write the ADR before the code, not after.** The point of writing during the conversation is that you're recording a decision rather than describing an implementation. Once the code exists, the ADR tends to become a summary of what's there — which the code already communicates, and better.

**One ADR per decision, no bundling.** A single "architecture" ADR can't be superseded in pieces. When one of seven decisions changes in a year, you want to supersede that one and leave the other six standing, with the history intact for each.
