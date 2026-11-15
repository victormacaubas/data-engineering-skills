# Default voice

Use this voice when the author hasn't given you samples of their own writing. If they have, their voice wins wherever it differs from this file.

The default voice is a senior practitioner writing to people they respect. It's warm without gushing, confident without bragging, and specific all the way through. It takes its rhythm, its sense of history, and its generosity toward the people who did the work from a company memo, and its directness, its real numbers, and its habit of talking straight to the reader from a practitioner's LinkedIn post.

## How the memo sounds

Read these passages for the music of the sentences, not only for what they say.

> In 1979, we released Microsoft Adventure, a text-based game that looked more like MS-DOS than an early version of Minecraft. Adapted by a single programmer, Gordon Letwin, one of Microsoft's first 13 employees and later an architect on OS/2, the game let players explore a digital world, collect treasure, solve puzzles, and encounter mythical creatures.

> Since joining XBOX, I've heard stories of friendships that began over a session and lasted a lifetime, of people who met the person they would marry, and of parents now sharing the games they grew up on with their children. I've also heard about people who are no longer with us, and how much those hours spent playing together still mean to those who love them. Ultimately, this is why we exist.

> While modern games demonstrate the heights of human craft in ways unimaginable just decades ago, the cost, resources, and risk required to create them have grown just as dramatically. As a result, too many ideas never become games, and too many games fall short of what their creators imagined. For decades, this has been the unavoidable tradeoff of ambition. We must change this.

What to take from them:

It tells things as a story in time. "In 1979...", "A few years later...", "In the mid-1990s...", "Twenty-five years later...". Dates and sequence carry the reader forward without any "First, let's look at". When your material has a before and an after, or a history, tell it in order and let the time markers do the structure.

Its long sentences are built from concrete pieces. The first passage packs a name, a job, a company history, and four things the player could do into two sentences, and it never feels heavy, because every piece is a fact. A long sentence is fine when each clause adds something real. It turns to mush when the clauses are adjectives.

Each run of long sentences ends on a short one that says what it means: "Ultimately, this is why we exist." "We must change this." This is the single most useful move to borrow. Write two or three sentences of detail, then one short sentence that lands the point. Do it a few times per post, not after every paragraph. Borrow the short sentence, not the word "Ultimately", which is on the AI-tells list.

It's generous and specific about people. It names Gordon Letwin and Bruce Artwick, recognizes "the 111 people... who have been here for 25 years or more", and tells them what they'll get (an engraved console). When the input names people who did the work, credit them by name and say what they did.

It states belief plainly, in the first person, once it has earned it: "I believe the future of gaming will look more like its beginning." No hedging and no hype. A conviction near the end of a post, after the evidence, reads as earned.

It's warm without sentimentality words. It never says "heartwarming" or "incredible". It gets warmth from what it describes (friends, marriages, parents and children) and lets the reader feel it.

## How the practitioner post sounds

> If you work on a data engineering team, then cost reduction is likely a major point of discussion.
>
> As a data consultant, I have managed to save millions of dollars over the past few years.
>
> [...]
>
> 7. Kill zombie workloads. I've seen companies spend well over 100k on a few ETL jobs and dashboards no one opens anymore! They have pipelines for deprecated features that no one knows is running. Delete them.

What to take from it:

It talks straight to the reader. An "If you..." opening that names the reader's situation works well for an advice post. Don't use it on every post.

It uses real amounts, in shorthand on LinkedIn ("100k a year for ingestion") and in full in a blog post ("$100,000").

It names messes the reader will recognize: "dashboards no one opens anymore", "pipelines for deprecated features that no one knows is running". Practitioners smile because they've seen it. Give a point one picture like this when the input supports it.

It gives blunt orders after the explanation: "Delete them." This is the practitioner's version of the memo's short closing sentence.

It can take one casual aside in parentheses, like a second thought said out loud: "(perhaps it's not that surprising)". One per post at most in this voice; the memo uses none.

The post has a few slips too ("then" after "If", "likely", the uncontracted "I have managed"). Take its directness, not those. `references/ai-tells.md` lists the slips to fix.

## Contractions and register

Both pieces mostly use contractions where people would say them: "I've heard", "You've helped", "Don't build", "I've seen". Write "don't", "it's", "we've", "isn't", "that's". A draft full of "do not", "it is", "that is", and "we have made" sounds like a manual, and it's the most common reason a draft reads stiff. Keep the full form only for emphasis ("We must change this").

Plain words, always: "usual suspects", "mess", "kill", "keep costs reasonable", "too many ideas never become games". Never "leverage", "unlock", "drive impact", or "best-in-class".

## Flat versus the default voice

The same facts, written twice, once for a blog post and once for LinkedIn. The facts in both are made up for the examples; never reuse them in a real post. Copy what changed between the versions, not the sentences themselves.

<example>
Flat:

> We completed the migration of our legacy reporting database to BigQuery. The project took eight months. The old server has now been decommissioned. This is a significant achievement for the team. Report performance has improved and costs have been reduced.

Default voice:

> Last Friday we switched off the reporting database that had run our company's numbers since 2016. It had outlived three CTOs, two office moves, and the engineer who installed it, and for most of that time nobody was sure what would happen if it went down. Moving it to BigQuery took eight months. The month-end report that used to run overnight now finishes in eleven minutes.
>
> Most of that work belongs to Priya and Marcus, who spent the winter reading stored procedures no one had opened in years. Thank you, both. We'll miss the old box a little. Not much.

What changed: the flat version reports that something happened; the voiced one tells it in time ("Last Friday", "since 2016"), builds a long sentence out of concrete pieces, swaps "performance has improved" for the actual before and after, credits two named people for a specific thing, uses contractions, and ends on two short sentences with a little humor.
</example>

<example>
Flat:

> Our team recently completed a cost optimization initiative for our Snowflake environment. We identified several unused pipelines and removed them. We also adjusted warehouse sizes. As a result, our monthly costs have decreased significantly. This demonstrates the importance of regular cost reviews.

Default voice:

> Our Snowflake bill was $41,000 in March. In June it was $26,000.
>
> We started by listing every scheduled job and the last time anyone queried what it produced. Eleven pipelines fed dashboards nobody had opened since the 2024 reorg, and one of them ran every fifteen minutes.
>
> We turned them off for two weeks and waited for complaints. None came, so we deleted them.
>
> The second fix was smaller. Three warehouses were sized Large because of one slow query in 2023. Medium handles the same work.
>
> If you haven't done this yet, export your job list, sort it by cost, and check when each output was last read.

What changed: the first line is the before-and-after number, so the reader knows the stakes before "see more"; "several unused pipelines" becomes eleven pipelines, a reorg, and a job running every fifteen minutes; "adjusted warehouse sizes" gets its reason; paragraphs run one to three sentences, not one line each; there's no humor, because the facts don't invite it; and the post ends on a first step a reader can take, not on "the importance of regular cost reviews".
</example>
