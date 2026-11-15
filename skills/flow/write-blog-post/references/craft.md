# Craft

These principles come from a company memo written for the 25th anniversary of the XBOX. It's a good model because it's warm and persuasive while it uses almost no adjectives of praise. The facts do the work. Each principle below has a short line from the memo and a rewrite in a data-engineering setting.

## Let specific facts carry the claim

The memo never says the original XBOX was "groundbreaking". It says the console "shipped with a hard drive when competitors asked players to buy standalone memory cards and an Ethernet jack when 9 in 10 households still used dial-up." The reader reaches "groundbreaking" on their own, and believes it more because they got there themselves.

When you want to call something fast, big, expensive, or important, find the fact that proves it and write that fact. Then delete the adjective.

Weak: "Our new pipeline dramatically improved performance."
Strong: "The nightly load used to finish at 7:40, twenty minutes after the finance team logged in. Now it's done by 4:15."

## Show scale with a comparison the reader can hold

The memo puts the first and the latest Flight Simulator side by side: "just 160 KB, with 2D graphics, 16 colors, and 20 total airports" against "more than 2.5 petabytes of data." Two numbers in contrast say more than any description of growth.

When the input has a before and an after, put them next to each other in one or two sentences. If one side is hard to picture, translate it into something familiar ("about the size of the whole warehouse in 2021").

## Vary the length of your sentences

The memo runs long, detailed sentences and then drops a short one: "Ultimately, this is why we exist." "We must change this." The short sentence lands because of the long ones around it.

Write most sentences at a natural medium length, let some run long when they carry a list of details, and place a short sentence where you want the reader to stop. A post where every sentence is the same length reads as machine-made, even when each sentence is fine on its own.

## Earn the claim before you make it

The memo spends most of its length on history and only near the end says what it believes: that small teams will soon build what once took hundreds of people. By then the reader has seen the pattern and is ready to agree.

In a blog post, tell what happened first and state the lesson after. In a short LinkedIn post, you can state the point first, but the very next lines must be the evidence for it, not more claims.

Weak: "Data quality is the foundation of everything. Without it, nothing works. That's why we invested in it."
Strong: "Last quarter, a null in one currency column made our revenue dashboard show 40% growth for six days. Nobody caught it until the CFO quoted it in a board deck. We now test that column on every load."

(The numbers in the strong version are an example only. In a real post, use only the facts in the input.)

## Give a blog post a story arc

A blog post needs a shape a reader can feel moving. A LinkedIn post doesn't; it's short enough to be one scene. Look at how the memo is built. It opens in 1979 with one programmer and a text game. It moves forward through the decades as the stakes grow (a secret project, a console nobody could miss, a billion players). It stops to thank the people who carried it. Then it turns: games have become so costly that "too many ideas never become games", and the closing section says what the writer believes comes next. Beginning, rising stakes, people, turn, belief.

Most engineering posts fit the same five beats:

1. **Where we started.** The situation before anything happened, with a time and a concrete detail: "In 2023, every report the sales team used ran off one Airflow server that nobody wanted to touch." (An illustration only; use the facts in the input.) Give the reader enough to care about what's at stake. Open on the scene or the stakes, not on a tutorial: if the post needs to explain how a system works, do it after the first paragraph has given the reader a reason to want to know. The biggest number in the story usually belongs near the top.
2. **What went wrong, or what got hard.** The complication, told in order with time markers. This is where the tension is, so don't rush it, and don't explain the cause yet.
3. **The turn.** The moment the team understood what was really going on: the query that showed the gap, the number that didn't match, the decision to stop patching and rebuild. The input almost always has one, even when it doesn't call it that: look for "the hard part was", "the surprise was", "it turned out", or the point where a plan changed. One short sentence often marks it.
4. **What we did and what changed.** The fix and its results, with before and after numbers. Credit the people by name if the input names them.
5. **What it means.** The lesson or belief, stated once and plainly, after the reader has seen the evidence. This is where a short landing sentence belongs.

Let the section headers follow the beats and name the moment, not the category: "The week the dashboards went blank" and "Why nobody noticed" pull a reader along, where "Background", "Root cause", and "Remediation" turn the post back into a postmortem. Not every post needs all five beats at equal length, and an opinion post can open on the claim and spend the arc on the story that led to it. But a reader should always be able to say where the post started, where it turned, and where it ended up.

## Thank and credit people with specifics

The memo doesn't say "thanks to everyone who made this possible." It names "the 111 people across XBOX and our studios who have been here for 25 years or more" and says each "will receive a special engraved console". Specific thanks reads as sincere, and general thanks reads as a form letter.

When a post credits a team or a person, say what they did: "Ana rewrote the dedup logic over a weekend" in place of "huge thanks to the amazing team".

## Name real things

The memo lists the franchises by name ("Call of Duty, Candy Crush, Diablo, Doom..."), the people by name (Gordon Letwin, Bruce Artwick), and the code name ("Project Midway"). Real names make a piece feel reported, not generated.

Name the tool, the table type, the warehouse, the version, and the year when the input gives them. "Snowflake", "a dbt incremental model", "Fivetran" read as experience. "Our data platform", "a modern tool", "a leading vendor" read as filler.

## End on something concrete

The memo ends on a plain statement of what the team will do ("deliver great games, unmistakable hardware, and give more people the chance to make something the world has never seen") and a short sign-off. It doesn't end on a slogan or a question.

End your post on the last useful thing: what the author does now, the number that sums it up, or the one thing they'd tell a peer to check first. Don't end on an abstract noun phrase such as "a new chapter in our data journey".

## Keep the structure quiet

The memo has two headers in about 900 words and no bold text in its paragraphs. The structure supports the reading and doesn't draw attention to itself. Use headers only when the subject changes, and use bold rarely or not at all.
