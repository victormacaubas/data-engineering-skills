---
name: write-jira-ticket
description: Write Jira tickets (tasks, bugs, spikes) in plain, human-sounding language via the Atlassian MCP. Use when the user wants to open, draft, or create a ticket — including phrasings like "file a ticket for this", "open an issue", or "track this as a task". Asks the user which project to use if not specified.
---

# Write Jira Ticket

Your job here is to turn what the user tells you into a clean Jira ticket that reads like a teammate wrote it, not a language model. Then create it in Jira using the Atlassian MCP.

## Step 1: Figure out the basics

Before writing anything, you need:

1. **Ticket type** (Task, Bug, Spike). If the user didn't say, infer from what they described and confirm briefly. Rough rules:
   - Bug: something is broken or behaving wrong
   - Task: a piece of work to do
   - Spike: investigation, research, or "figure out if/how"
2. **Project**. Ask the user which project to use if they haven't specified one. If the user mentioned a project (by name or key), use that.
3. **Summary**. One line, concrete, specific. Not a headline, not marketing copy.

If the user hasn't given you enough to write a useful ticket, ask. Don't invent details. One of the fastest ways tickets become useless is when someone pads them with guesses.

## Step 2: Write it in human voice

The whole reason this skill exists is that default AI writing has a tell. Readers clock it instantly and it makes the author look like they didn't care enough to write the ticket themselves. Avoid the tells.

### Things to avoid

**Em dashes and en dashes.** Don't use `—` or `–` anywhere. They are the single biggest giveaway. If you feel like you need one, use a period, a comma, parentheses, or just rewrite the sentence. A regular hyphen inside a compound word (`read-only`, `end-to-end`) is fine. What's not fine is using a hyphen as a sentence level separator the way em dashes get used.

**Buzzwords and corporate filler.** These words almost never earn their place:

> leverage, streamline, robust, seamless, comprehensive, holistic, synergy, empower, unlock, elevate, ensure (when it means "make sure"), utilize (when it means "use"), facilitate, enable (when used vaguely)

If you catch yourself reaching for one, use the plain version instead. "Use" beats "leverage". "Make sure" beats "ensure". "Help" beats "empower".

**Throat clearing phrases.** Cut these:

> It's important to note that, It's worth mentioning, In order to, As such, Furthermore, Moreover, Additionally (as a transition word), In conclusion

**Over structured bullet lists** where every bullet has the same length and parallel grammar. Real people write some short bullets and some longer ones. They don't rewrite every line to match.

**Hedging softeners.** "We may want to consider potentially looking into" should just be "We should look at".

### Things to do

- Use contractions (`don't`, `we'll`, `can't`). They read naturally.
- Write short sentences. Mix in longer ones when you actually need them.
- Be specific. "The sync job fails after ~3 hours on the production dataset" beats "The sync job has intermittent issues".
- Admit uncertainty when it's real. "Not sure if this is the root cause, but it's the best lead we have" is fine.
- Use second person or first person plural naturally. "We need to" or "You'll hit this when".

### Quick before/after

**AI sounding:**
> This ticket aims to comprehensively address the issue where our data pipeline experiences intermittent failures. We'll need to leverage our existing monitoring infrastructure to ensure we can streamline the debugging process.

**Human sounding:**
> The data pipeline fails a few times a week with no obvious pattern. We need to add better logging around the retry logic so we can tell what's actually going wrong.

## Step 3: Structure by ticket type

Keep the structure only as heavy as the ticket needs. A two line task doesn't need five headings. A gnarly bug does.

### Task

```
Summary: <one line, concrete>

## Context
Why this work matters. What prompted it. Skip if obvious from the summary.

## What to do
The actual work. Can be a paragraph or a short list. Don't split hairs.

## Done when
What "done" looks like. Not a formal acceptance criteria ritual, just the bar.
```

### Bug

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

### Spike

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

## Step 4: Show the draft first, then create

Before calling the Atlassian MCP, show the user the draft ticket so they can tweak it. Format it the way it'll appear in Jira. Something like:

> Here's the draft. Say the word and I'll create it, or tell me what to change.

Once they approve, create it.

## Step 5: Create it in Jira

Use the Atlassian MCP tools. The flow:

1. Get the cloudId. Try passing the site hostname first (e.g., `your-site.atlassian.net`) to `createJiraIssue` as `cloudId`. If that fails, call `getAccessibleAtlassianResources` to list cloudIds.
2. Call `mcp__atlassian-tech__createJiraIssue` with:
   - `cloudId`
   - `projectKey`: the project key the user specified (e.g., `ENG`, `DATA`)
   - `issueTypeName`: `Task`, `Bug`, or `Spike` (confirm the project actually has that type, fall back to `Task` if unsure)
   - `summary`: the one line summary
   - `description`: the body, formatted as markdown
   - `contentFormat`: `markdown`
3. Report back the issue key and URL so the user can open it.

If the user wants priority, labels, components, or a specific assignee, pass them in `additional_fields`. Don't add these unless asked. Cluttered tickets are worse than sparse ones.

## A few more things

- If the user gives you a long thread of context (Slack conversation, error logs, meeting notes), your job is to compress it into the ticket, not copy it verbatim. Pull out what matters and leave the rest.
- If you're unsure whether something belongs in the ticket, lean toward leaving it out. Future readers will thank you.
- Don't add a "Generated by Claude" footer or anything similar. The whole point is that the ticket should look like a human wrote it.
