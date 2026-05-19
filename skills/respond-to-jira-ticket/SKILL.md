---
name: respond-to-jira-ticket
description: Write comments on existing Jira tickets in plain, human-sounding language via the Atlassian MCP. Use when the user wants to reply, comment, update, or post on a Jira ticket — e.g. "respond to PROJ-123", "update the ticket", or after finishing work that needs reporting. Asks the user which project to use if not specified.
---

# Respond to Jira Ticket

Your job is to help the user post a comment on an existing Jira ticket that reads like a teammate wrote it, not a language model. Sometimes you're drafting from scratch, sometimes you're polishing a rough message the user wrote, sometimes you're pulling what happened in the current session and turning it into a status update. Same voice in all three cases.

## The three modes

Figure out which mode fits from context. You usually won't have to ask which one.

1. **Polish mode.** The user pasted a rough draft (a few sentences, maybe with typos, awkward phrasing, or just too long). Clean it up: fix grammar, tighten, make it clearer. Keep their voice, don't rewrite it into something they wouldn't say. Skip the ticket lookup unless they reference one. Polish mode does **not** need up-front questions unless something is genuinely ambiguous.

2. **Draft-from-ticket mode.** The user mentioned a ticket (by key like `PROJ-123`, by URL, or by description) and wants a response. Read the ticket first, then ask the user targeted questions about what they did, where things stand, and anything else the ticket thread is asking for. Then draft.

3. **Session-context mode.** You just finished some work together (fixed a bug, ran an investigation, shipped a PR) and the user wants to report it on a ticket. Read the ticket for context on what the audience is expecting, then confirm the key facts with the user before drafting. Even when you think you know what happened, a quick "so what I'd say is X, Y, Z, does that match what you want to report?" is better than inventing.

These modes blend in practice. A single request might be "clean this up and post it on PROJ-456" which is polish + post. That's fine, just do both.

## Default flow

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

## Writing in human voice

The whole reason this skill exists is that default AI writing has a tell. Tickets and comments full of em dashes and "comprehensive solutions" make the author look like they outsourced their job. Avoid the tells.

These rules mirror the `write-jira-ticket` skill on purpose, because the voice should be the same whether you're filing a ticket or commenting on one.

### Things to avoid

**Em dashes and en dashes.** Don't use `—` or `–` anywhere. This is the single biggest giveaway. If you feel like you need one, use a period, a comma, parentheses, or rewrite the sentence. Hyphens inside compound words (`read-only`, `end-to-end`) are fine.

**Buzzwords and corporate filler.**

> leverage, streamline, robust, seamless, comprehensive, holistic, synergy, empower, unlock, elevate, ensure (when it means "make sure"), utilize (when it means "use"), facilitate, enable (when vague)

Use the plain version. "Use" beats "leverage". "Make sure" beats "ensure". "Help" beats "empower".

**Throat clearing phrases.** Cut these:

> It's important to note that, It's worth mentioning, In order to, As such, Furthermore, Moreover, Additionally (as a transition word), In conclusion, I hope this helps, Please let me know if you have any questions

On that last one: if it's useful to invite follow-up, write it in your own words ("lmk if it pops back up", "happy to dig more if you want"). The canned version reads like a corporate email.

**Over-structured bullet lists** where every bullet is the same length and grammar. Real people write a couple of short bullets and maybe one longer one. For a comment, prose usually beats bullets anyway. Comments are conversational.

**Hedging softeners.** "We may want to consider potentially looking into" should just be "We should look at".

**Opening with a greeting when the thread doesn't use them.** If the rest of the thread is "ok thanks" and "pushed the fix", don't open yours with "Hi team, I wanted to follow up regarding...". Match the thread.

### Things to do

- Use contractions (`don't`, `we'll`, `can't`, `lmk`). They read naturally.
- Short sentences. Mix in longer ones when you need them.
- Be specific about what happened. "Reverted in #2817, should be good now" beats "The issue has been addressed".
- Admit uncertainty when it's real. "Not sure if this fully fixes it, but it clears the symptom we were seeing" is fine.
- Match the tone of the thread. If prior comments are casual, stay casual. If the ticket has a PM or external stakeholder asking formally, lift slightly but don't go corporate.

## Comment structure

Most comments don't need headings. They're a few sentences to a short paragraph. Only structure it if you genuinely have multiple distinct things to say (e.g., "here's what I did", "here's what I'm still not sure about", "here's next steps").

**Common comment shapes:**

- **Status update.** What you did, where things stand, what's next if anything. 2 to 5 sentences.
- **Answering a question.** Direct answer first, then the reasoning. Don't bury the answer.
- **Handoff / wrapping up.** What got fixed, the PR link, how to verify, close when ready.
- **Pushback.** If you disagree with something in the ticket, say so plainly and give the reason. Not "I wonder if we might potentially want to reconsider".
- **Investigation writeup.** Longer comment reporting what you tested, what you found, and what you're still uncertain about. Use bold section headers (`**Section name**`) rather than prose paragraphs when the content genuinely has 3+ distinct parts. Keep sections short. This is the shape where multiple headings earn their place.

### The "Open question" pattern

When the comment contains a direct ask to another person (a question that needs an answer, a request to review, a poke to a stakeholder), pull it out into its own short section with a clear heading like **Open question** or **What I need from you**. Two reasons:

1. In a long comment, a question buried in paragraph 4 often goes unanswered. A dedicated section makes the ask impossible to miss.
2. The reader knows at a glance whether this comment needs something from them or is just an FYI.

Keep the section tight: name the person, state the question, say what you'd do with the answer. One or two sentences. If the comment has no ask, skip this section, don't invent one.

## Before/after examples

**AI sounding (reply to "hey any update on this?"):**
> Hi team, I wanted to provide a comprehensive update on the current status of this ticket. I have successfully completed the investigation and identified the root cause, which I have subsequently addressed through a merge request. Please let me know if you have any further questions — I'm happy to help!

**Human sounding:**
> Looked into it. The DAG was failing because of a duplicate alert in the config. Reverted in #2817, should be good now. Lmk if it pops back up.

**AI sounding (status on a bug):**
> After thorough investigation, I was able to identify that the intermittent failures are being caused by a race condition in the retry logic. I will leverage our existing monitoring infrastructure to ensure we can streamline the debugging process going forward.

**Human sounding:**
> Found it — race condition in the retry logic when two workers pick up the same task. Added more logging around it in the PR I just opened. Going to watch it for a couple of days before calling it done.

(Note the em dash snuck in on that last one. In your actual output, replace it with something else. The example is here to make the point, not to copy verbatim.)

## When the user pastes a rough draft

Polish mode has a subtle trap: don't rewrite it into a different voice. If the user wrote "ya so the thing is basically done, just need to test it real quick", don't turn it into "Work on this task is nearing completion pending final verification". Keep their register. Tighten, fix clear grammar issues, cut filler. That's it.

A good polish usually looks like:
- 10 to 30 percent shorter
- Clearer about what happened vs what's next
- No typos or obvious grammar mistakes
- Same voice as the original

If the draft is already clean, say so and offer a couple of small tweaks rather than rewriting it out of some obligation to earn your keep.

### Non-native English drafts

The user writes in English but it's not their first language, so drafts may have grammar issues that a native speaker wouldn't make. Fix these confidently. The user wants the comment to read smoothly, not to preserve mistakes out of some misguided respect for the original.

Common things to watch for and quietly fix:
- **Articles** (`a`, `an`, `the`): often missing or used where not needed.
- **Prepositions**: "depends of" → "depends on", "discuss about" → "discuss".
- **Verb tense consistency**: mixed past/present in a single thought.
- **Word order**: adjective placement, adverb placement.
- **Countable vs uncountable nouns**: "informations" → "information", "a feedback" → "feedback".
- **False friends**: words that look like Portuguese/Spanish/etc. but mean something different in English ("eventually" doesn't mean "possibly", "actually" doesn't mean "currently").
- **Slightly off phrasings** that are grammatically OK but not what a native speaker would say. Rephrase into something natural.

Beyond fixing errors, **upgrade the vocabulary where it helps the user sound like a native speaker in their field**. This is the piece that separates "grammatically correct" from "written by a native". Two things to look for:

1. **Reach for the word a native speaker would actually use.** If the user wrote "I made some tests", a native would say "I ran some tests". If the user wrote "the problem happens sometimes", a native would often say "the issue pops up intermittently" or "it's flaky". Don't swap words just to show off vocabulary, but when the natural word is clearly better, use it.

2. **Use domain jargon when it fits.** The user works in data engineering, so the right term usually exists. Examples a data engineer would naturally use: "hits the warehouse", "backfill", "upstream/downstream", "row count", "query plan", "cold start", "idempotent", "flaky", "re-run the DAG", "bumped the version", "pinned the dependency", "spun up", "stood up", "drain the queue", "dual-write", "read replica", "PII masking", "RBAC", "secondary role", "OAuth session", "token refresh", "compilation error". If the user described something in plain English and there's a standard technical term for it, use the standard term. If they already used the right term, leave it.

The tricky balance: fix the English and sharpen the vocabulary, but keep the personality. If the original reads like a casual Slack message, the polished version should still read like a casual Slack message, just without the grammar speed bumps and with the sharper word choices. Don't "elevate" it into something formal just because you cleaned it up. And don't jargon-bomb a message that was never trying to be technical.

If the user seems uncertain about their draft ("not sure if this sounds right"), briefly say which specific parts you changed and why, in one line each. That way they learn the pattern, and they can push back if you changed something they actually meant.

## Posting to Jira

Once the user approves, use the Atlassian MCP:

1. **cloudId.** Try the site hostname first (e.g., `your-site.atlassian.net`) as `cloudId`. If that fails, call `mcp__atlassian-tech__getAccessibleAtlassianResources`.
2. **Post the comment** with `mcp__atlassian-tech__addCommentToJiraIssue`:
   - `cloudId`
   - `issueIdOrKey`: e.g., `PROJ-123`
   - `commentBody`: the comment text, as markdown
   - `contentFormat`: `"markdown"`
3. **Report back.** Tell the user it's posted and give them the ticket URL (or the comment link if the MCP returns one).

If the user wants to mention someone, they'll usually say so. Ask for the person's account ID or use `mcp__atlassian-tech__lookupJiraAccountId` to find it, then format the mention as the MCP expects.

## Flag things before posting, don't silently fix

When you're polishing a draft, some issues deserve a quick heads-up to the user before you post, rather than a silent fix. These are the kinds of things where a silent fix risks posting something wrong or where the user has context you don't.

Flag these up front when you see them:

- **Technical errors in code or SQL** the user pasted. Double underscores in column names, `COUNT()` missing a `*`, wrong table name, a typo in a config key. These look like paste errors, but if the user actually ran a different version that worked, you don't want to rewrite their evidence. Mention what you saw, say you fixed it in the polished version, and let them revert if needed.
- **`@mentions` that need an account ID** for the notification to actually fire in Jira. Plain text `@Name` reads fine but won't ping anyone. Ask whether they want a real mention (in which case you'll look up the account ID) or plain text.
- **Facts that feel uncertain or contradictory** in the draft. If the user wrote "deployed to prod" in one spot and "merged to main" in another, ask which is right before posting.
- **Ambiguous references** you had to guess at. If "it" could mean two things and you picked one, say so.

Keep the flags short: a numbered list before the draft, one line each. Don't turn it into a lecture. The point is to catch small issues cheaply, not to slow the user down.

## A few more things

- **Don't invent facts.** If you don't know whether the fix is in prod or staging, don't write that it's in prod. Ask, or say "deployed to staging" if that's what you know.
- **Don't add a "Generated by Claude" footer.** The whole point is that the comment should look like the user wrote it.
- **Don't copy the full ticket back into the comment.** A comment is a response, not a recap. If something needs referencing, quote the relevant line or link a PR.
- **If the ticket is in another project**, that's fine, the user will say so. Just use the right project key.
- **If the user asks you to just output the text without posting**, do that. No need to insist on going through the MCP.
