---
name: jira-ticket
description: Write Jira tickets and comments in plain, human-sounding language via the Atlassian MCP. Use when the user wants to create a ticket ("file a ticket", "open an issue", "track this as a task") OR respond to an existing ticket ("respond to PROJ-123", "update the ticket", "comment on this", "post a status update"). Also use after finishing work that needs reporting on a ticket. Asks the user which project to use if not specified.
---

# Jira Ticket

Your job is to help the user write things in Jira that read like a teammate wrote them, not a language model. That means both creating new tickets and posting comments on existing ones. Same voice, same care, two different actions.

## Which mode?

Figure out from context whether the user wants to **create** a new ticket or **respond** to an existing one. You usually won't have to ask.

- **Create mode.** The user wants to file a new ticket (task, bug, spike). Phrases like "file a ticket for this", "open an issue", "track this as a task", or just describing a piece of work that needs tracking.
- **Respond mode.** The user wants to comment on an existing ticket. Phrases like "respond to PROJ-123", "update the ticket", "post what we did", or pasting a rough draft they want cleaned up before posting.

---

## Create mode

### Gather the basics

Before writing anything, you need:

1. **Ticket type** (Task, Bug, Spike). If the user didn't say, infer from what they described and confirm briefly. Rough rules:
   - Bug: something is broken or behaving wrong
   - Task: a piece of work to do
   - Spike: investigation, research, or "figure out if/how"
2. **Project**. Ask the user which project to use if they haven't specified one. If the user mentioned a project (by name or key), use that.
3. **Summary**. One line, concrete, specific. Not a headline, not marketing copy.

If the user hasn't given you enough to write a useful ticket, ask. Don't invent details. One of the fastest ways tickets become useless is when someone pads them with guesses.

### Structure by ticket type

Keep the structure only as heavy as the ticket needs. A two line task doesn't need five headings. A gnarly bug does.

#### Task

```
Summary: <one line, concrete>

## Context
Why this work matters. What prompted it. Skip if obvious from the summary.

## What to do
The actual work. Can be a paragraph or a short list. Don't split hairs.

## Done when
What "done" looks like. Not a formal acceptance criteria ritual, just the bar.
```

#### Bug

```
Summary: <what's broken, in plain terms>

## What's happening
The observed behavior. Be specific about where and when.

## What should happen
The expected behavior.

## How to reproduce
Steps if you have them. If you don't, say what you know (e.g., "happens on the prod cluster, hasn't reproduced locally yet").

## Impact
Who it affects and how much. Skip if obvious.

## Notes
Anything else useful: logs, links, suspected cause. Skip if nothing to add.
```

#### Spike

```
Summary: <the question to answer>

## Why we're looking at this
The decision or work this unblocks.

## What we want to find out
Specific questions. Not open ended "investigate X".

## Deliverable
What comes out of the spike. Usually a short writeup, a recommendation, or a proof of concept.

## Timebox
How long this should take before we cut it off and decide with what we have.
```

You don't need every section every time. If something genuinely has nothing to say, leave it out rather than filling it with "N/A" or filler.

### Show draft and create

Before calling the Atlassian MCP, show the user the draft ticket so they can tweak it. Format it the way it'll appear in Jira. Something like:

> Here's the draft. Say the word and I'll create it, or tell me what to change.

Once they approve, create it. If the user gives you a long thread of context (Slack conversation, error logs, meeting notes), your job is to compress it into the ticket, not copy it verbatim. Pull out what matters and leave the rest.

---

## Respond mode

### The three sub-modes

Figure out which fits from context. You usually won't have to ask.

1. **Polish mode.** The user pasted a rough draft (a few sentences, maybe with typos, awkward phrasing, or just too long). Clean it up: fix grammar, tighten, make it clearer. Keep their voice, don't rewrite it into something they wouldn't say. Skip the ticket lookup unless they reference one. Polish mode does **not** need up-front questions unless something is genuinely ambiguous.

2. **Draft-from-ticket mode.** The user mentioned a ticket (by key like `PROJ-123`, by URL, or by description) and wants a response. Read the ticket first, then ask the user targeted questions about what they did, where things stand, and anything else the ticket thread is asking for. Then draft.

3. **Session-context mode.** You just finished some work together (fixed a bug, ran an investigation, shipped a PR) and the user wants to report it on a ticket. Read the ticket for context on what the audience is expecting, then confirm the key facts with the user before drafting. Even when you think you know what happened, a quick "so what I'd say is X, Y, Z, does that match what you want to report?" is better than inventing.

These modes blend in practice. A single request might be "clean this up and post it on PROJ-456" which is polish + post. That's fine, just do both.

### Respond flow

For polish mode, the flow is short: clean up the draft, show it, post on approval. Skip the rest of this section.

For draft-from-ticket and session-context modes:

1. **Identify the ticket.** If the user gave a key or URL, grab it. If not, ask which ticket you're responding to.
2. **Read the ticket.** Use `mcp__atlassian-tech__getJiraIssue` with `responseContentFormat: "markdown"`. Pay attention to the latest comments, not just the description. The thread tells you who's asking what and in what tone. Note if there's a specific question to answer, a status request, or a stakeholder waiting on something.
3. **Ask the user targeted questions before drafting.** This is the part that matters. After reading the ticket, work out what the response needs to cover, and ask the user a small number of specific questions to fill it in. Examples:
   - "The ticket asks if the fix is deployed. Is it on prod, staging, or just merged?"
   - "What did you actually change? I can see some commits on this branch but want to make sure I describe it right."
   - "Is there a next step or is this closing out?"
   Use session context to skip questions you can already answer (don't ask "did you merge the PR" if you watched them merge it 5 minutes ago). Keep the list short, usually 1 to 4 questions. If you genuinely don't need to ask anything, say so and move on.
4. **Draft the response.** Use the user's answers, the session context, and the thread's tone. Don't pad.
5. **Show the draft.** Format it as it'll appear in Jira. Something like "Here's the draft. Say the word and I'll post it on PROJ-123, or tell me what to change."
6. **Post on approval.** Use `mcp__atlassian-tech__addCommentToJiraIssue` with `contentFormat: "markdown"`.

The reason to ask before drafting is that responses are short, and a wrong fact or wrong emphasis in a 3-sentence comment is more jarring than in a long ticket. Better to confirm for 20 seconds than to write something the user has to largely rewrite.

### Comment structure

Most comments don't need headings. They're a few sentences to a short paragraph. Only structure it if you genuinely have multiple distinct things to say (e.g., "here's what I did", "here's what I'm still not sure about", "here's next steps").

**Common comment shapes:**

- **Status update.** What you did, where things stand, what's next if anything. 2 to 5 sentences.
- **Answering a question.** Direct answer first, then the reasoning. Don't bury the answer.
- **Handoff / wrapping up.** What got fixed, the PR link, how to verify, close when ready.
- **Pushback.** If you disagree with something in the ticket, say so plainly and give the reason. Not "I wonder if we might potentially want to reconsider".
- **Investigation writeup.** Longer comment reporting what you tested, what you found, and what you're still uncertain about. Use bold section headers (`**Section name**`) rather than prose paragraphs when the content genuinely has 3+ distinct parts. Keep sections short.

#### The "Open question" pattern

When the comment contains a direct ask to another person (a question that needs an answer, a request to review, a poke to a stakeholder), pull it out into its own short section with a clear heading like **Open question** or **What I need from you**. Two reasons:

1. In a long comment, a question buried in paragraph 4 often goes unanswered. A dedicated section makes the ask impossible to miss.
2. The reader knows at a glance whether this comment needs something from them or is just an FYI.

Keep the section tight: name the person, state the question, say what you'd do with the answer. One or two sentences. If the comment has no ask, skip this section, don't invent one.

---

## Writing in human voice

The whole reason this skill exists is that default AI writing has a tell. Tickets and comments full of em dashes and "comprehensive solutions" make the author look like they outsourced their job. Avoid the tells.

### Things to avoid

**Em dashes and en dashes.** Don't use `---` or `--` anywhere. This is the single biggest giveaway. If you feel like you need one, use a period, a comma, parentheses, or rewrite the sentence. Hyphens inside compound words (`read-only`, `end-to-end`) are fine. What's not fine is using a hyphen as a sentence-level separator the way em dashes get used.

**Buzzwords and corporate filler.** These words almost never earn their place:

> leverage, streamline, robust, seamless, comprehensive, holistic, synergy, empower, unlock, elevate, ensure (when it means "make sure"), utilize (when it means "use"), facilitate, enable (when vague)

Use the plain version. "Use" beats "leverage". "Make sure" beats "ensure". "Help" beats "empower".

**Throat clearing phrases.** Cut these:

> It's important to note that, It's worth mentioning, In order to, As such, Furthermore, Moreover, Additionally (as a transition word), In conclusion, I hope this helps, Please let me know if you have any questions

On that last one: if it's useful to invite follow-up, write it in your own words ("lmk if it pops back up", "happy to dig more if you want"). The canned version reads like a corporate email.

**Over-structured bullet lists** where every bullet is the same length and grammar. Real people write some short bullets and some longer ones. They don't rewrite every line to match. For a comment, prose usually beats bullets anyway.

**Hedging softeners.** "We may want to consider potentially looking into" should just be "We should look at".

**Opening with a greeting when the thread doesn't use them.** If the rest of the thread is "ok thanks" and "pushed the fix", don't open yours with "Hi team, I wanted to follow up regarding...". Match the thread.

### Things to do

- Use contractions (`don't`, `we'll`, `can't`, `lmk`). They read naturally.
- Short sentences. Mix in longer ones when you need them.
- Be specific about what happened. "Reverted in #2817, should be good now" beats "The issue has been addressed".
- Admit uncertainty when it's real. "Not sure if this fully fixes it, but it clears the symptom we were seeing" is fine.
- Match the tone of the thread. If prior comments are casual, stay casual. If the ticket has a PM or external stakeholder asking formally, lift slightly but don't go corporate.
- Use second person or first person plural naturally. "We need to" or "You'll hit this when".

### Before/after examples

**AI sounding (ticket description):**
> This ticket aims to comprehensively address the issue where our data pipeline experiences intermittent failures. We'll need to leverage our existing monitoring infrastructure to ensure we can streamline the debugging process.

**Human sounding:**
> The data pipeline fails a few times a week with no obvious pattern. We need to add better logging around the retry logic so we can tell what's actually going wrong.

**AI sounding (comment reply to "hey any update on this?"):**
> Hi team, I wanted to provide a comprehensive update on the current status of this ticket. I have successfully completed the investigation and identified the root cause, which I have subsequently addressed through a merge request. Please let me know if you have any further questions!

**Human sounding:**
> Looked into it. The DAG was failing because of a duplicate alert in the config. Reverted in #2817, should be good now. Lmk if it pops back up.

---

## Polishing drafts

Drafts may have grammar issues. Fix these confidently. The user wants the text to read smoothly, not to preserve mistakes out of some misguided respect for the original.

Common things to watch for and quietly fix:
- **Articles** (`a`, `an`, `the`): often missing or used where not needed.
- **Prepositions**: "depends of" -> "depends on", "discuss about" -> "discuss".
- **Verb tense consistency**: mixed past/present in a single thought.
- **Word order**: adjective placement, adverb placement.
- **Countable vs uncountable nouns**: "informations" -> "information", "a feedback" -> "feedback".
- **False friends**: words that look like Portuguese/Spanish/etc. but mean something different in English ("eventually" doesn't mean "possibly", "actually" doesn't mean "currently").
- **Slightly off phrasings** that are grammatically OK but not what a native speaker would say. Rephrase into something natural.

Beyond fixing errors, **upgrade the vocabulary where it helps the user sound like a native speaker in their field**. Two things to look for:

1. **Reach for the word a native speaker would actually use.** If the user wrote "I made some tests", a native would say "I ran some tests". If the user wrote "the problem happens sometimes", a native would often say "the issue pops up intermittently" or "it's flaky". Don't swap words just to show off vocabulary, but when the natural word is clearly better, use it.

2. **Use domain jargon when it fits.** The right term usually exists. Examples: "hits the warehouse", "backfill", "upstream/downstream", "row count", "query plan", "cold start", "idempotent", "flaky", "re-run the DAG", "bumped the version", "pinned the dependency", "spun up", "stood up", "drain the queue", "dual-write", "read replica". If the user described something in plain English and there's a standard technical term for it, use the standard term. If they already used the right term, leave it.

The tricky balance: fix the English and sharpen the vocabulary, but keep the personality. If the original reads like a casual Slack message, the polished version should still read like a casual Slack message, just without the grammar speed bumps and with the sharper word choices.

If the user seems uncertain about their draft ("not sure if this sounds right"), briefly say which specific parts you changed and why, in one line each. That way they learn the pattern, and they can push back if you changed something they actually meant.

---

## Flag things before posting, don't silently fix

When you're polishing a draft or writing from session context, some issues deserve a quick heads-up to the user before you post, rather than a silent fix. These are the kinds of things where a silent fix risks posting something wrong or where the user has context you don't.

Flag these up front when you see them:

- **Technical errors in code or SQL** the user pasted. Double underscores in column names, `COUNT()` missing a `*`, wrong table name, a typo in a config key. Mention what you saw, say you fixed it in the polished version, and let them revert if needed.
- **`@mentions` that need an account ID** for the notification to actually fire in Jira. Plain text `@Name` reads fine but won't ping anyone. Ask whether they want a real mention (in which case you'll look up the account ID) or plain text.
- **Facts that feel uncertain or contradictory** in the draft. If the user wrote "deployed to prod" in one spot and "merged to main" in another, ask which is right before posting.
- **Ambiguous references** you had to guess at. If "it" could mean two things and you picked one, say so.

Keep the flags short: a numbered list before the draft, one line each. Don't turn it into a lecture.

---

## Posting to Jira (MCP mechanics)

Once the user approves, use the Atlassian MCP.

### Getting the cloudId

Try the site hostname first (e.g., `your-site.atlassian.net`) as `cloudId`. If that fails, call `mcp__atlassian-tech__getAccessibleAtlassianResources` to list available cloudIds.

### Creating a ticket (create mode)

Call `mcp__atlassian-tech__createJiraIssue` with:
- `cloudId`
- `projectKey`: the project key the user specified (e.g., `ENG`, `DATA`)
- `issueTypeName`: `Task`, `Bug`, or `Spike` (confirm the project actually has that type, fall back to `Task` if unsure)
- `summary`: the one-line summary
- `description`: the body, formatted as markdown
- `contentFormat`: `"markdown"`

If the user wants priority, labels, components, or a specific assignee, pass them in `additional_fields`. Don't add these unless asked. Cluttered tickets are worse than sparse ones.

Report back the issue key and URL so the user can open it.

### Posting a comment (respond mode)

Call `mcp__atlassian-tech__addCommentToJiraIssue` with:
- `cloudId`
- `issueIdOrKey`: e.g., `PROJ-123`
- `commentBody`: the comment text, as markdown
- `contentFormat`: `"markdown"`

Report back that it's posted and give the ticket URL (or comment link if the MCP returns one).

### Mentions

If the user wants to mention someone, ask for the person's account ID or use `mcp__atlassian-tech__lookupJiraAccountId` to find it, then format the mention as the MCP expects.

---

## A few more things

- **Don't invent facts.** If you don't know whether the fix is in prod or staging, don't write that it's in prod. Ask, or say "deployed to staging" if that's what you know.
- **Don't add a "Generated by Claude" footer.** The whole point is that the output should look like the user wrote it.
- **Don't copy the full ticket back into a comment.** A comment is a response, not a recap. If something needs referencing, quote the relevant line or link a PR.
- **If the ticket is in another project**, that's fine, the user will say so. Just use the right project key.
- **If the user asks you to just output the text without posting**, do that. No need to insist on going through the MCP.
- **If you're unsure whether something belongs in a ticket**, lean toward leaving it out. Future readers will thank you.
