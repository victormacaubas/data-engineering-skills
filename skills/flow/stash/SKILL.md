---
name: stash
description: Park content into the Obsidian vault's inbox/ folder raw — no synthesizing, no placement — so /process-inbox can file it later. Use when the user says "stash this", "save this conversation", "park this for later", "dump the session", or wants to offload content before running out of context. Handles the current conversation (default), pasted articles, meeting notes, and ad-hoc content.
---

# /stash

Park content in the Obsidian vault's `inbox/` folder so a later `/process-inbox` pass can file it. **Offload the session's context:** stash does not synthesize, rewrite, or place content. It saves raw (or as-raw-as-possible) material in inbox with an appropriate filename prefix, then exits.

## Why this exists

During a deep conversation, the current session's agent may have a nearly full context window. Synthesis or vault placement in that session uses tokens and can drop information. `/stash` moves that work to a fresh session: dump the material here, then process it later with clear context.

Reconstructing a conversation still uses context. It costs less than full synthesis, placement, linking, and INDEX regeneration.

## Usage

```
/stash                                 # stash the current conversation (default)
/stash <topic-slug>                    # stash current conversation with explicit slug
/stash meeting                         # stash current conversation as meeting notes (preserve-shape)
/stash article                         # stash pasted article-shaped content
/stash note                            # stash ad-hoc text as a short note
```

Users can also invoke this skill by intent. Phrases like "stash this conversation", "dump this for later", and "park these notes in inbox" route here.

## Vault path

Inbox is at:

```
/Users/victor-macaubas/Documents/Personal_Projects/llm-second-brain/inbox/
```

This path is hardcoded. The skill works from any current working directory. If the vault moves, update this constant in the skill.

## When to invoke

Use this when:

- The user wants to capture the current conversation so it can be processed later in the vault.
- The user pasted something (an article, meeting notes, or a dump) and wants it saved raw without filing.
- The user has a quick idea to park for the distiller instead of filing it.
- The session's context is filling up and the user wants to end the session with the material preserved.

**Don't use this for:**

- Content ready for proper placement → run `/process-inbox` after stashing; `/stash` only captures it.
- Writing a finished note directly into a knowledge folder → use `obsidian:obsidian-markdown` to edit the vault directly.
- URL clipping → the user has Obsidian Web Clipper for that. It drops content into `inbox/` with article-shaped frontmatter. `/stash` covers manual and conversation capture, not clipping.

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

- **Slug**: derive it from the main topic. Use lowercase kebab-case, with 3-6 words max. E.g. `process-inbox-skill-design`, `datadog-pipeline-architecture`, `vault-tooling-discussion`.
- **Date**: use an absolute ISO date. Convert relative dates ("today", "yesterday") to YYYY-MM-DD in the user's local timezone.

If the user passes an explicit slug as `/stash <slug>`, use it verbatim after kebab-normalizing it.

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

`distill_as` is a hint, not a directive. The distiller detects the shape and uses this value as a tiebreaker. Conversations always get `synthesize`; meetings/articles always get `preserve`; notes leave it off so the distiller asks.

## Content shape by input type

### Conversation (default — the hard case)

Reconstruct the conversation from memory. You do not have a verbatim transcript. Use the full session context you have and write it down faithfully.

**Use this file structure:**

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

1. **Faithful, not fabricated.** If you cannot recall a specific number, name, or quote, write `[not captured]` or `[approximate]` rather than guess. The distiller cannot recover invented details.
2. **Substance over stylistic polish.** The distiller rewrites prose in a later pass. Preserve raw material instead of writing the final note.
3. **Preserve load-bearing content:** named people, tool names, specific decisions (with reasoning), rejected alternatives, links, numbers, constraints, deadlines.
4. **Don't compress.** Length follows substance. If the conversation was long and substantive, the stash is long. Trimming filler words is OK; dropping decisions or alternatives is not.
5. **Third-person, session-voice.** "The user asked about X. I suggested Y. We landed on Z." Describe the session instead of using first-person "I thought..." introspection.

### Meeting notes (user pasted)

Save the pasted content verbatim as the file body. Add the frontmatter above it. Do not edit the content. The distiller preserves it later.

### Article (user pasted)

Follow the meeting-notes format: verbatim body with frontmatter above it. The distiller preserves it later.

### Ad-hoc note / idea

Save the text the user gave you verbatim. Add frontmatter. Omit `distill_as:` so the distiller asks how to treat it.

## The write itself

- Target directory: `/Users/victor-macaubas/Documents/Personal_Projects/llm-second-brain/inbox/`
- Create the file using the `obsidian:obsidian-markdown` skill (or a direct write; the frontmatter is simple enough for either).
- **Never** write anywhere else in the vault. Only `inbox/`.
- If a file with the same name already exists, append a `-v2` / `-v3` suffix instead of overwriting it.

## Report to the user

After writing, give a compact report:

```
Stashed: inbox/convo-process-inbox-skill-design-2026-05-04.md
Shape hint for distiller: synthesize (conversation)
Size: ~3.2 KB / ~540 words

Things flagged for re-check during distillation:
  • Exact filename we chose for the NXS note — may have been slightly different
  • The exact count of notes in INDEX.md at the time

Next: run /process-inbox in an in-vault session to file it properly.
```

Include the "flagged for re-check" list when you use `[not captured]` / `[approximate]` anywhere in the file. It identifies what the distiller and user need to verify.

## Edge cases

**Vault doesn't exist at the hardcoded path.** Stop and tell the user: "I can't find the vault at `<path>`. Has it moved?" Do not silently write somewhere else.

**User invokes `/stash` but there's nothing obvious to stash.** If the conversation so far is trivial (a few turns with no substance) or the user did not paste anything, ask: "What should I stash? I can dump the conversation so far, or capture something you paste."

**User invokes from inside the vault directory.** Same behavior — write to `<vault>/inbox/`. The skill is location-agnostic by design.

**Conversation contains sensitive content** (credentials, private data, etc.). Ask the user before stashing. The inbox is a file on disk, and the distiller processes it later. If the user confirms, redact obvious secrets (replace with `[REDACTED]`) before writing.

**Multiple stashes in one session.** Each stash writes a separate file. Filenames differ by slug (or `-v2` suffix if slugs collide). The distiller handles however many files end up in inbox.

## Guardrails

- Never write outside `<vault>/inbox/`.
- Never synthesize conversation content into a finished wiki note; that is the distiller's job. Capture raw material.
- Never fabricate quotes, numbers, or names you don't remember. Flag gaps with `[not captured]`.
- Never delete or modify existing inbox items. Stash only adds.
- Don't bother updating INDEX.md or README.md. Inbox is excluded from both, and the distiller handles index updates in its own pass.
