---
name: write-blog-post
description: Write LinkedIn posts, blog posts, and articles that sound like an experienced human practitioner wrote them, with strong professional craft and none of the usual signs of AI writing. Matches the author's own voice when they share writing samples, and otherwise uses a direct, practical default voice. Use this whenever the user wants to write, draft, rewrite, or polish a post, article, or announcement for LinkedIn, a blog, Medium, Substack, or a company engineering blog. Covers "write a post about", "turn these notes into a LinkedIn post", "clean up my draft", "make this sound less like AI", "make this sound like me", and turning a PR, design doc, project summary, or incident write-up into a post for a wider audience. Use it even when the user only pastes rough bullets and says "post this" or "make something out of this". Not for Jira tickets, ticket comments, Slack messages, or internal docs.
---

# Write Blog Post

You're writing a post that the user will publish under their own name. When someone reads it, they should think a sharp, experienced person wrote it in one sitting. Nothing in it should make them suspect a model.

Your reply is the post, plus only the notes Step 6 allows. Don't open with "Here's your post", a summary of what you did, or notes about your process. Keep your fact list, your plan, and your checks in your thinking. None of them belong in the reply.

## Reference files

| File | What it holds | When to read it |
|---|---|---|
| `references/craft.md` | What makes the writing good in any voice, including the story arc for blog posts | Always, at the end of Step 3 |
| `references/voice.md` | The default voice, with examples | Only when the author gave no writing samples (Step 3) |
| `references/ai-tells.md` | The patterns that make a post read as machine-written, and small slips to fix | At the start of Step 5 |

## Step 1: Work out the mode and the format

Read the request and decide two things. You can usually tell without asking.

The mode is one of three. In notes mode, the user gives you bullets, a topic, or a rough idea, and you write the post. In draft mode, the user gives you a post they wrote, and you improve it while it stays their post. In source mode, the user gives you technical material such as a PR, a design doc, or an incident write-up, and you turn it into a post for people who didn't do the work.

The format is LinkedIn or blog. An article, or a post for Medium, Substack, or an engineering blog, is a blog post. If the request says "post" with no platform and the material is short, assume LinkedIn. If you really can't tell, ask one short question and stop. If no one can answer (you're running as a background worker), assume LinkedIn and say so in a note.

## Step 2: Collect the facts

Before you write, list in your thinking every number, dollar amount, percentage, duration, tool, company, team, and result in the input. The post may use only these facts, plus plain arithmetic on them (600 seconds is 10 minutes). This rule matters more than any style rule. An invented statistic or a made-up client story is the fastest way to lose a technical reader, and it can embarrass the author in public. If a sentence would be stronger with a number you don't have, write it without the number, or ask for it.

Explaining what the facts mean is your job (Step 4). Adding a new claim isn't: an opinion, a ranking ("the cheapest fix"), a cause, or a motive that the input doesn't state. If you add one because the input clearly implies it, list it in your note (Step 6) so the author can check it.

If the input is too thin to carry a good post (one line, no concrete detail), ask one or two specific questions, such as "What did the bill go from and to?" or "What broke, and how did you find out?". Then stop and wait. If no one can answer, write the short post the facts support and list your questions in the note. A short, true post beats a long, padded one.

## Step 3: Find the voice

Look for the author's own writing. They may have pasted samples in the conversation, pointed you to a file, or named a voice note or sample posts in their `CLAUDE.md` or `AGENTS.md`. In draft mode, their draft is itself a sample.

- If you have samples, read them closely and match them: how they open, how long their sentences run, whether they use contractions, their everyday words, their humor, how formal they get, how they close. Their voice wins wherever it differs from the default voice. Don't read `references/voice.md`.
- If you have no samples, read `references/voice.md` and write in that voice.

Use American English spelling and usage in every case ("organization", "optimize", "behavior"), even when the samples or the draft spell things another way. Match everything else about the samples.

Then read `references/craft.md` before you draft.

## Step 4: Draft

Two rules do the most work. Say the concrete thing in place of the general thing. And vary your sentence length, so the rhythm sounds like a person talking and not a list of statements.

### LinkedIn

Aim for 120 to 300 words, and never go over 300. If the input only supports 90 good words, write 90. Write plain text with no markdown, since LinkedIn shows asterisks and pound signs as they are. The first line should be a concrete statement (a fact, a number, a situation the reader is in), so the reader knows what the post is about before "see more". Write paragraphs of one to three sentences with a blank line between them. Don't put every sentence on its own line, because that staircase shape is one of the most recognized LinkedIn tells. Use a numbered list only when the content really is a list of separate items. Use no emoji and no hashtags unless the author's input has them or they ask.

### Blog post

Length and development. Aim for 600 to 1,200 words, and never go over 1,200. Go under 600 only when the input has just a handful of facts. "No invented facts" doesn't mean "no development": a blog post earns its length by explaining what the facts mean. Why did this matter, what did it cost, what was the team weighing, why did one decision work, what should a reader in the same spot watch for? That reasoning is what separates a post from a list of notes. Develop each beat with it, and keep the facts themselves to the input.

Form. Give it a plain, specific title (a statement or a question a reader would search for, not a pun). Use at most three section headers, and only where the subject changes. A header names a moment in plain words ("The week the dashboards went blank", "How we found the zombie jobs"), not a category ("Background", "Root cause") and not a clever phrase ("The Cold Reality"). Most of the post should be connected prose, where each paragraph follows from the one before. Use at most one bold phrase.

Arc. In your thinking, plan the five beats from `references/craft.md`: where things started, what went wrong or got hard, the turn, what the team did and what changed, and what it means. Never name the beats in the post ("The turn came when..."); the reader should feel the shape, not see the outline. Make the main claim after you've shown the evidence.

### Draft mode

Keep the author's structure, claims, examples, and as many of their own sentences as you can. Keep every point they make, too, including their lesson or takeaway: when a point is phrased badly ("a testament to fostering a culture of ownership"), rewrite it plainly ("Tests catch the break. An owner makes sure someone fixes it."), and don't delete it. The AI-tells list applies to the draft itself, so remove the tells you find in it (hashtag blocks, emoji bullets, the staircase, engagement bait) even though the author wrote them. Fix small slips (spelling, spacing, grammar, wrong word). If the draft is already good, change very little.

### Source mode

Keep every fact that matters to an outside reader and drop internal detail they don't need (ticket numbers, internal service names, who was on call). Explain what happened and why it matters to someone in the same field who isn't on the author's team. Keep one or two specific technical details, because they're what make the post credible. Leave out customer names and security details (vulnerabilities, credentials, internal hostnames). Keep cost and revenue figures, since they usually carry the story, but list any that look internal in your note so the author can check they're safe to publish.

### Names

In every mode, keep the vivid names that carry the story, such as the nickname of a server everyone was afraid to reboot, or the colleague who built the fix. Drop a name only when it means nothing outside the team or isn't safe to publish.

### Endings

Finish on the last useful thing you have to say, such as a concrete lesson, a number, or a plain statement of what the author does now. End once. If you've already given the reader a checklist or a piece of advice, don't restate it in a closing line; and don't follow a lessons paragraph with a second "so check this week" paragraph. Don't add a question to readers ("What do you think?", "I'd love to hear your tips"), an invitation to DM, or a pitch unless the input asks for one. When it does, make it specific: "I'm happy to set up 20 to 30 minutes to chat" reads as a real person, and "Let's connect!" doesn't.

## Step 5: Check the draft

Do this before you reply, even for a short post, and do it in your thinking. The reply carries only the corrected post.

First read `references/ai-tells.md` and go through the draft against it, one section at a time. Rewrite each hit the way that file describes.

Then answer each question. When the answer is no, fix the draft and ask again.

1. Is every number, name, and result on your fact list from Step 2, or plain arithmetic on it?
2. Is the draft free of em-dashes (—), and of en-dashes or spaced hyphens used as dashes? Replace each with a comma, a colon, parentheses, or a new sentence.
3. Is there no reader question, DM invitation, or pitch, unless the input asked for one?
4. Is the length under the ceiling: 300 words for LinkedIn, 1,200 for a blog post?
5. Have you contracted every "do not", "does not", "is not", "it is", "that is", "we have", "I have", and "I will" ("don't", "it's", "we've")? Keep the full form only for emphasis, or when the author's samples avoid contractions.
6. Does the post end once, on its last useful point?
7. Read it as the author's colleague would. Does it sound like the voice from Step 3? With samples, put a paragraph of yours next to one of theirs. With the default voice, look for at least one run of detailed sentences that ends on a short sentence landing the point, and for real names and before-and-after numbers in place of words like "improved". If it still reads like a report, compare it with the examples in `references/voice.md` and rewrite toward the voiced versions.

## Step 6: Reply

Reply with the post. For a blog post, put the title on the first line as a markdown heading.

After the post, add a line with three dashes, then a short plain list of only the notes that apply:

- In draft mode, the main changes and why, so the author can undo any of them.
- Any sentence that adds a cause, motive, opinion, or ranking the input only implies.
- In source mode, any figure that looks internal.
- Any default you took or question you couldn't ask because no one could answer.

If none apply, reply with the post alone. Never post, publish, or send the text anywhere. The author posts it themselves.
