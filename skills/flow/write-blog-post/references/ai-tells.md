# AI tells to remove

These are the patterns that make readers suspect a model wrote a post. Go through the draft one section at a time. When a pattern appears, rewrite the sentence so the idea is said plainly, often with a fact from the input in place of the vague phrase. Don't swap one flagged word for a synonym, because readers notice the shape of the sentence more than the word.

Some patterns below are always out. Others are fine once and suspicious when they repeat; each entry says which.

## Sentence shapes

**"Not X, it's Y" and its relatives.** Always out. This includes "It's not just X, it's Y", "This isn't about X. It's about Y", "X isn't a cost, it's an investment", "not only X but also Y" used for drama, "Not A, not B, just C", the denial-first opener ("The cause wasn't a bad query or a bad source row. A connector upgrade..."), and the tacked-on contrast closer ("before you need them, not after", "measure cost, not runtime" used as a slogan). State Y directly, and only mention X when a reader would really have assumed it. "This isn't a tooling problem. It's a process problem." becomes "The tool was fine. Nobody owned the cost review."

**Trailing "-ing" clauses that add vague importance.** Always out. Examples: "..., highlighting the importance of governance", "..., ensuring long-term scalability", "..., underscoring our commitment to quality", "..., fostering a culture of ownership". Delete the clause. If it held a real fact, make that fact its own sentence.

**Tidy groups of three.** Fine when the three items are real and different ("partitions, clustering, and incremental loads"). Out when the items are interchangeable words chosen for rhythm ("fast, reliable, and scalable", "bold, brave, and brilliant"). Keep the one word that is true and has evidence, and cut the others.

**The setup and reveal.** Out. A short teaser sentence followed by the answer: "The result? A 40% drop." "Here's the thing:" "The kicker:" "Spoiler:". Write the sentence straight: "The bill dropped 40%."

**Rhetorical questions the post answers itself.** Fine once in a blog post. Out in a LinkedIn post, and out as an opening line. "So what went wrong?" becomes the answer.

**Every sentence the same length.** Read the draft aloud in your head. If it ticks along at the same pace, join two sentences or split one long one.

## Words and phrases

**Stock vocabulary.** Replace these with a plain word or, better, a fact: delve, dive into, deep dive, tapestry, testament, landscape, realm, ever-evolving, game-changer, game changer, unlock, unleash, leverage (as a verb), harness, elevate, empower, supercharge, streamline, robust, seamless, cutting-edge, best-in-class, pivotal, crucial, vital, paramount, intricate, multifaceted, nuanced, comprehensive, showcase, underscore, highlight (as a verb about meaning), foster, navigate (anything that isn't a map), journey (anything that isn't travel), quietly (as in "quietly became the most important table"), at the end of the day, in today's fast-paced world, it's worth noting, importantly, notably, additionally, moreover, furthermore, in conclusion, ultimately (as an opener for a summary).

One of these words in a long blog post can be coincidence. Two or more in a short post is a strong signal. Remove them all from LinkedIn posts.

**"Serves as", "stands as", "boasts", "features".** Use "is" or "has". "The table serves as our single source of truth" becomes "Everything reads from this table."

**Inflated significance.** Out: "a pivotal moment", "a testament to", "left an indelible mark", "a reminder that", "speaks volumes", "marks a new era", "redefines how we think about". Say what changed and for whom.

**Vague sources.** Out: "experts say", "studies show", "industry reports suggest", "many teams find". Name the source from the input, or speak from the author's own experience ("I've seen..."), or cut the sentence.

**Hedging disclaimers.** Out: "While results may vary...", "It's important to remember that every organization is different". The voice is confident. If a real caveat matters, state it in specific terms: "This works for tables over about a billion rows. Below that, the clustering cost can outweigh the savings."

**Feelings the input doesn't show.** Out: "I'm humbled", "I'm thrilled", "a humbling moment", "incredibly proud". Use an emotion only when the author's input expresses it, and say it in their plain words.

## LinkedIn moves

All of these are out unless the author asks for them. In draft mode, remove them from the author's draft too: being in the draft isn't the same as asking for them.

- Announcement openers: "Excited to share...", "Thrilled to announce...", "I'm happy to share that...". Start with the news itself.
- Teaser openers: "I want to share some reflections on...", "Let's talk about...", "Here's what I learned from...", "Unpopular opinion:". Start with the concrete fact.
- Drama one-liners: "Let that sink in.", "Read that again.", "This changed everything.".
- The staircase: every sentence on its own line. Group sentences into short paragraphs.
- Emoji bullets or emoji at the start of lines (🚀 ✅ 💡 👇). Use plain numbers or plain sentences.
- Engagement bait at the end: "Agree?", "Thoughts?", "What would you add? 👇", "Let me know in the comments!", "Follow for more", "Repost if this helped ♻️".
- Borrowed wisdom: "As they say, culture eats strategy for breakfast." Say the point in the author's own words.
- Hashtag blocks. Use none unless the author asks.

## Openings and closings

**Openings.** Out: "In today's data-driven world...", "Data is the new oil", "As data engineers, we all know...", a dictionary definition, or a question. Open with the concrete situation, the number, or a direct "If you..." to the reader.

**Closings.** Out: a summary of what the post just said, a "Despite these challenges..." outlook paragraph, an abstract noun phrase with a halo ("a new chapter in our data journey", "the future of data is bright"), and "In conclusion". End on the last concrete point.

## Punctuation and format

**Em-dashes.** Always out, in every format. Readers now treat them as a sign of machine writing, so the skill bans them outright. Replace each with a comma, a colon, parentheses, or two sentences. Also don't use a spaced hyphen or en-dash as a dash ("the bill - which was huge - dropped").

**Bold.** Out in LinkedIn posts (it doesn't render). In blog posts, at most one bold phrase, and never a bold label at the start of every list item or paragraph.

**Headers.** Never in LinkedIn posts. At most three in a blog post. Headers say what the section is about in plain words, not a clever phrase ("How we found the zombie jobs", not "The Cold Reality").

**Colons before every list.** "Here's what we did:" followed by bullets, repeated through a post, is a template. Use prose where the items connect to each other, and a list only where they are truly separate.

## Facts

**Invented details.** Always out. No number, percentage, dollar amount, date, client, company, tool, quote, or result that isn't in the input. This includes made-up but "plausible" statistics such as "studies show 60% of data teams...". If the sentence needs a fact you don't have, rewrite it without the fact, or ask the author.
