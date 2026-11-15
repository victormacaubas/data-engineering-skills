---
name: write-blog-post
description: Write LinkedIn posts, blog posts, and articles that sound like an experienced human practitioner wrote them, with strong professional craft and none of the usual signs of AI writing. Matches the author's own voice when they share writing samples, and otherwise uses a direct, practical default voice. Use this whenever the user wants to write, draft, rewrite, or polish a post, article, or announcement for LinkedIn, a blog, Medium, Substack, or a company engineering blog. Covers "write a post about", "turn these notes into a LinkedIn post", "clean up my draft", "make this sound less like AI", "make this sound like me", and turning a PR, design doc, project summary, or incident write-up into a post for a wider audience. Use it even when the user only pastes rough bullets and says "post this" or "make something out of this".
---

# Write Blog Post

You're writing a post that the user will publish under their own name. When someone reads it, they should think a sharp, experienced person wrote it in one sitting. Nothing in it should make them suspect a model.

Your final reply is the post itself. Don't open with "Here's your post", a summary of what you did, or notes about your process. The one exception is draft mode, described below.

## Step 1: Work out the mode and the format

Read the request and decide two things. You can usually tell without asking.

The mode is one of three. In notes mode, the user gives you bullets, a topic, or a rough idea, and you write the post. In draft mode, the user gives you a post they wrote, and you improve it while it stays their post. In source mode, the user gives you technical material such as a PR, a design doc, or an incident write-up, and you turn it into a post for people who didn't do the work.

The format is LinkedIn or blog. If the request says "post" with no platform and the material is short, assume LinkedIn. If you really can't tell, ask one short question and stop.

## Step 2: Collect the facts

Before you write, make a private list of every number, dollar amount, percentage, duration, tool, company, team, and result in the input. The post may use only these facts, plus plain arithmetic on them (600 seconds is 10 minutes). This rule matters more than any style rule. An invented statistic or a made-up client story is the fastest way to lose a technical reader, and it can embarrass the author in public. If a sentence would be stronger with a number you don't have, write it without the number, or ask for it.

The same goes for claims. Don't add an opinion, a ranking ("the cheapest fix"), or a cause that the input doesn't support. If you add a sentence the input only implies, mention it in your reply so the author can check it.

If the input is too thin to carry a good post (one line, no concrete detail), ask one or two specific questions, such as "What did the bill go from and to?" or "What broke, and how did you find out?". Then stop and wait. A short, true post beats a long, padded one.

## Step 3: Find the voice

Look for the author's own writing. They may have pasted samples in the conversation, pointed you to a file, or have a voice note or sample posts named in their CLAUDE.md. In draft mode, their draft is itself a sample.

If you have samples, read them closely and match them: how they open, how long their sentences run, whether they use contractions, their everyday words, their humor, how formal they get, how they close. Their voice wins wherever it differs from `references/voice.md`. If you have no samples, use `references/voice.md` as the voice.

Write in American English spelling and usage in every case ("organization", "optimize", "behavior"), even when the samples spell things another way. Match everything else about the samples.

Either way, read `references/craft.md` before you draft. It covers what makes the writing good no matter whose voice it's in. Read `references/ai-tells.md` before Step 5.

## Step 4: Draft

Two rules do the most work. Say the concrete thing in place of the general thing. And vary your sentence length, so the rhythm sounds like a person talking and not a list of statements.

For a LinkedIn post, aim for 120 to 300 words, and never go over 300. If the input only supports 90 good words, write 90. Write plain text with no markdown, since LinkedIn shows asterisks and pound signs as they are. The first line should be a concrete statement (a fact, a number, a situation the reader is in), so the reader knows what the post is about before "see more". Write paragraphs of one to three sentences with a blank line between them. Don't put every sentence on its own line, because that staircase shape is one of the most recognized LinkedIn tells. Use a numbered list only when the content really is a list of separate items. Use no emoji and no hashtags unless the author's input has them or they ask.

For a blog post, aim for 600 to 1,200 words, and never go over 1,200. Go under 600 only when the input has just a handful of facts. "No invented facts" doesn't mean "no development": a blog post earns its length by explaining what the facts mean. Why did this matter, what did it cost, what was the team weighing, why did one decision work, what should a reader in the same spot watch for? That reasoning is your job, and it's what separates a post from a list of notes. Develop each beat with it, and keep the facts themselves to the input. Give it a plain, specific title (a statement or a question a reader would search for, not a pun). Use at most three section headers, and only where the subject changes. Most of the post should be connected prose, where each paragraph follows from the one before. Give it a story arc: where things started, what went wrong or got hard, the turn where the team understood it, what they did and what changed, and what it means. `references/craft.md` explains each beat. Plan the beats before you write, but never name them in the post ("The turn came when..."); the reader should feel the shape, not see the outline. Let the headers name the moments ("The week the dashboards went blank"), not the categories ("Background", "Root cause"). Make the main claim after you've shown the evidence.

In draft mode, keep the author's structure, claims, examples, and as many of their own sentences as you can. Keep every point they make, too, including their lesson or takeaway: when a point is phrased badly ("a testament to fostering a culture of ownership"), rewrite it plainly ("Tests catch the break. An owner makes sure someone fixes it."), and don't delete it. The AI-tells list applies to the draft itself, so remove the tells you find in it (hashtag blocks, emoji bullets, the staircase, engagement bait) even though the author wrote them. Fix small slips (spelling, spacing, grammar, wrong word). If the draft is already good, change very little. After the post, add a line with three dashes, then a short plain list of the main changes and why, so the author can undo any of them.

In source mode, keep every fact that matters to an outside reader and drop internal detail they don't need (ticket numbers, internal service names, who was on call). Explain what happened and why it matters to someone in the same field who isn't on the author's team. Keep one or two specific technical details, because they're what make the post credible. In every mode, keep the vivid names that carry the story, such as the nickname of a server everyone was afraid to reboot, or the colleague who built the fix. Drop a name only when it means nothing outside the team or isn't safe to publish.

Endings: finish on the last useful thing you have to say, such as a concrete lesson, a number, or a plain statement of what the author does now. End once. If you've already given the reader a checklist or a piece of advice, don't restate it in a closing line; and don't follow a lessons paragraph with a second "so check this week" paragraph. Stop when the point has landed. Don't add a question to readers ("What do you think?", "I'd love to hear your tips"), an invitation to DM, or a pitch unless the input asks for one. When it does, make it specific: "I'm happy to set up 20 to 30 minutes to chat" reads as a real person, and "Let's connect!" doesn't.

## Step 5: Check the draft

Read `references/ai-tells.md`, then go through the draft against it, one section at a time. When you find a hit, rewrite the whole sentence so the idea is said plainly. Don't swap the flagged word for a synonym, because readers notice the shape of the sentence more than the word.

Then run these five checks and fix anything that fails:

1. Every number, name, and result in the draft is on your fact list from Step 2, or is plain arithmetic on it.
2. The draft has no em-dash (—) and no en-dash or spaced hyphen used as a dash. Use a comma, a colon, parentheses, or a new sentence.
3. There's no reader question, DM invitation, or pitch unless the input asked for one.
4. The length is under the ceiling for the format.
5. Search the draft for "do not", "does not", "is not", "it is", "that is", "we have", "I have", and "I will". Contract each one ("don't", "it's", "we've") unless it's there for emphasis or the author's samples avoid contractions. Then read the draft as the author's colleague would. Does it sound like the voice from Step 3? With the default voice, check for at least one run of detailed sentences that ends on a short sentence landing the point, and for real names and before-and-after numbers in place of words like "improved". If it still reads like a report, compare it with the flat and voiced examples in `references/voice.md` and rewrite toward the voiced one. If you used samples, put a paragraph of yours next to one of theirs.

## Step 6: Reply

Reply with the post and nothing else (plus the change list in draft mode, and a one-line note about any sentence you added that the input only implies). For a blog post, put the title on the first line as a markdown heading. Never post, publish, or send the text anywhere. The author posts it themselves.
