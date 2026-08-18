---
name: stash
description: Park content into the Obsidian vault's inbox/ folder raw — no synthesizing, no placement — so /process-inbox can file it later. Use when the user says "stash this", "save this conversation", "park this for later", "dump the session", or wants to offload content before running out of context. Handles the current conversation (default), pasted articles, meeting notes, and ad-hoc content.
---

# /stash

Park content in the Obsidian vault's `inbox/` folder so a later `/process-inbox` pass can file it properly. The point is to **offload the session's context** — stash does not synthesize, rewrite, or place. It captures raw (or as-raw-as-possible) material and drops it in inbox with an appropriate filename prefix, then exits.

## Why this exists

When the user is deep in a conversation, their current session's agent often has a nearly-full context window. Running synthesis or vault placement in that session burns tokens and risks dropping information. `/stash` moves that work to a fresh session: dump the material here, process it with clear context later.

This is NOT free — reconstructing a conversation still costs context — but it's cheaper than full synthesis, placement, linking, and INDEX regeneration.

## Usage

```
/stash                                 # stash the current conversation (default)
/stash <topic-slug>                    # stash current conversation with explicit slug
/stash meeting                         # stash current conversation as meeting notes (preserve-shape)
/stash article                         # stash pasted article-shaped content
/stash note                            # stash ad-hoc text as a short note
```

The user can also invoke by intent — phrases like "stash this conversation", "dump this for later", "park these notes in inbox" all route here.

## Vault path

Inbox is at:

```
/Users/victor-macaubas/Documents/Personal_Projects/llm-second-brain/inbox/
```

This is hardcoded — the skill works from any current working directory. If the vault ever moves, update this constant in the skill.

## When to invoke

Use this when:

- The user wants to capture the current conversation so it can be processed later in the vault.
- The user pasted something (an article, meeting notes, a dump) and wants it saved raw without filing.
- The user has a quick idea they want to park — not file — for the distiller to handle.
- The session's context is getting full and the user wants to bail out with the material preserved.

**Don't use this for:**

- Filing content that's ready to be placed properly → that's `/process-inbox` after the stash, not the stash itself.
- Writing a finished note directly into a knowledge folder → use `obsidian:obsidian-markdown` to edit the vault directly.
- URL clipping → the user has Obsidian Web Clipper for that; it drops straight into `inbox/` with article-shaped frontmatter already. `/stash` is the manual/conversation path, not a clipper replacement.

## Filename scheme

```
<prefix>-<kebab-slug>-<YYYY-MM-DD>.md
```

| Content type | Prefix | Distiller will... |
|---|---|---|
| Conversation (default) | `convo-` | synthesize |
| Meeting notes | `meeting-` | preserve |
| Pasted article | `article-` | preserve |
| Ad-hoc note / idea | `note-` | prompt (ambiguous shape) |

- **Slug**: derive from the main topic. Kebab-case, lowercase. 3-6 words max. E.g. `process-inbox-skill-design`, `datadog-pipeline-architecture`, `vault-tooling-discussion`.
- **Date**: absolute ISO date. Convert any relative date ("today", "yesterday") to YYYY-MM-DD in the user's local timezone.

If the user passes an explicit slug as `/stash <slug>`, use it verbatim (but still kebab-normalize).

## Frontmatter (required)

Every stashed file starts with this frontmatter:

```yaml
---
title: <Human-readable topic>
date: YYYY-MM-DD
description: <one-line summary of what's in the file>
source: conversation            # or: pasted-content | url | ad-hoc
tags:
  - inbox
  - <content-type>              # convo | meeting-notes | article | note
distill_as: synthesize          # or: preserve  — hint for the distiller
---
```

`distill_as` is a hint, not a directive — the distiller does its own shape detection and uses this as a tiebreak. Conversations always get `synthesize`; meetings/articles always get `preserve`; notes leave it off so the distiller asks.

## Content shape by input type

### Conversation (default — the hard case)

Reconstruct from memory. Not a verbatim transcript — you don't have one. What you *do* have is the full session context; write it down faithfully.

**Structure the file like this:**

```markdown
---
<frontmatter>
---

# <Human-readable topic>

<1-2 sentence framing of what the conversation was about.>

## <Topic or phase 1>

<Brief narrative of what was discussed, written in third person about the session:
"The user proposed X. I pushed back on Y because Z. We landed on W.">

- Decision: <the thing decided, briefly>
- Rejected alternative: <what was considered and why it didn't win>
- Named entities: <people, tools, systems, platforms mentioned>
- Links: <any URLs or references that came up>
- Open question: <anything left unresolved>

## <Topic or phase 2>

...

## Things to double-check

<Anything where your reconstruction feels hazy — specific numbers, exact names, a
quote that may not be word-for-word. Flagging these protects the distiller's
later verification pass.>
```

**Rules for reconstruction:**

1. **Faithful, not fabricated.** If you don't remember a specific number, name, or quote, write `[not captured]` or `[approximate]` rather than guess. The distiller can't recover what you invent here.
2. **Substance over stylistic polish.** The distiller will rewrite prose in a later pass. You're not writing the final note — you're preserving raw material.
3. **Preserve load-bearing content:** named people, tool names, specific decisions (with reasoning), rejected alternatives, links, numbers, constraints, deadlines.
4. **Don't compress.** Length follows substance. If the conversation was long and substantive, the stash is long. Trimming filler words is OK; dropping decisions or alternatives is not.
5. **Third-person, session-voice.** "The user asked about X. I suggested Y. We landed on Z." Avoid first-person "I thought..." narration — you're describing the session, not introspecting.

### Meeting notes (user pasted)

Save the pasted content verbatim as the body of the file. Add the frontmatter on top. Do not edit the content. Distiller will preserve it later.

### Article (user pasted)

Same as meeting notes — verbatim body + frontmatter on top. Distiller will preserve.

### Ad-hoc note / idea

Save the text the user gave you verbatim. Add frontmatter. Keep `distill_as:` out — the distiller will ask how to treat it.

## The write itself

- Target directory: `/Users/victor-macaubas/Documents/Personal_Projects/llm-second-brain/inbox/`
- Create the file using the `obsidian:obsidian-markdown` skill (or a direct write — frontmatter is simple enough that either works).
- **Never** write anywhere else in the vault. Only `inbox/`.
- If a file with the same name already exists, append a `-v2` / `-v3` suffix rather than overwrite.

## Report to the user

After the write, give a compact report:

```
Stashed: inbox/convo-process-inbox-skill-design-2026-05-04.md
Shape hint for distiller: synthesize (conversation)
Size: ~3.2 KB / ~540 words

Things flagged for re-check during distillation:
  • Exact filename we chose for the NXS note — may have been slightly different
  • The exact count of notes in INDEX.md at the time

Next: run /process-inbox in an in-vault session to file it properly.
```

Include the "flagged for re-check" list when you used `[not captured]` / `[approximate]` anywhere in the file. This gives the distiller (and the user) a head start on what to verify.

## Edge cases

**Vault doesn't exist at the hardcoded path.** Stop and tell the user: "I can't find the vault at `<path>`. Has it moved?" Don't silently write somewhere else.

**User invokes `/stash` but there's nothing obvious to stash.** If the conversation so far is trivial (just a few turns, no real substance) or the user didn't paste anything, ask: "What should I stash? I can dump the conversation so far, or capture something you paste."

**User invokes from inside the vault directory.** Same behavior — write to `<vault>/inbox/`. The skill is location-agnostic by design.

**Conversation contains sensitive content** (credentials, private data, etc.). Ask the user before stashing — the inbox is a file on disk, and the distiller will later process it. If the user confirms, redact obvious secrets (replace with `[REDACTED]`) before writing.

**Multiple stashes in one session.** Each one writes a separate file. Filenames differ via slug (or `-v2` suffix if slugs collide). The distiller handles however many files end up in inbox.

## Guardrails

- Never write outside `<vault>/inbox/`.
- Never synthesize conversation content into a finished wiki note — that's the distiller's job. You're capturing raw material.
- Never fabricate quotes, numbers, or names you don't remember. Flag gaps with `[not captured]`.
- Never delete or modify existing inbox items. Stash only adds.
- Don't bother updating INDEX.md or README.md — inbox is excluded from both. The distiller handles index updates on its own pass.
