# AI tells to remove

These are the patterns that make readers suspect a model wrote a post. Go through the draft one section at a time. When a pattern appears, rewrite the sentence so the idea is said plainly, often with a fact from the input in place of the vague phrase. Don't swap one flagged word for a synonym, because readers notice the shape of the sentence more than the word.

Each entry starts with when the pattern is out: always, or only under the condition it names.

## Sentence shapes

**"Not X, it's Y" and its relatives.** Always out. This includes "It's not just X, it's Y", "This isn't about X. It's about Y", "X isn't a cost, it's an investment", "not only X but also Y" used for drama, "Not A, not B, just C", the denial-first opener ("The cause wasn't a bad query or a bad source row. A connector upgrade..."), and the tacked-on contrast closer ("before you need them, not after", "measure cost, not runtime" used as a slogan). State Y directly, and only mention X when a reader would really have assumed it. "This isn't a tooling problem. It's a process problem." becomes "The tool was fine. Nobody owned the cost review."

**Trailing "-ing" clauses that add vague importance.** Always out. Examples: "..., highlighting the importance of governance", "..., ensuring long-term scalability", "..., underscoring our commitment to quality", "..., fostering a culture of ownership". Delete the clause. If it held a real fact, make that fact its own sentence.

**Tidy groups of three.** Out when the items are interchangeable words chosen for rhythm ("fast, reliable, and scalable", "bold, brave, and brilliant"). Fine when the three items are real and different ("partitions, clustering, and incremental loads"). Keep the one word that is true and has evidence, and cut the others.

**The setup and reveal.** Always out. A short teaser sentence followed by the answer: "The result? A 40% drop." "Here's the thing:" "The kicker:" "Spoiler:". Write the sentence straight: "The bill dropped 40%."

**Rhetorical questions the post answers itself.** Always out in a LinkedIn post and as an opening line. Fine once in a blog post. "So what went wrong?" becomes the answer.

**Every sentence the same length.** Always out. Read the draft aloud in your head. If it ticks along at the same pace, join two sentences or split one long one.

## Words and phrases

**Stock vocabulary.** Always out in a LinkedIn post. In a long blog post, one can be coincidence, but two or more is a strong signal, so remove them. Replace each with a plain word or, better, a fact: delve, dive into, deep dive, tapestry, testament, landscape, realm, ever-evolving, game-changer, game changer, unlock, unleash, leverage (as a verb), harness, elevate, empower, supercharge, streamline, robust, seamless, cutting-edge, best-in-class, pivotal, crucial, vital, paramount, intricate, multifaceted, nuanced, comprehensive, showcase, underscore, highlight (as a verb about meaning), foster, navigate (anything that isn't a map), journey (anything that isn't travel), quietly (as in "quietly became the most important table"), at the end of the day, in today's fast-paced world, it's worth noting, importantly, notably, additionally, moreover, furthermore, in conclusion, ultimately (as an opener for a summary).

**"Serves as", "stands as", "boasts", "features".** Always out. Use "is" or "has". "The table serves as our single source of truth" becomes "Everything reads from this table."

**Inflated significance.** Always out: "a pivotal moment", "a testament to", "left an indelible mark", "a reminder that", "speaks volumes", "marks a new era", "redefines how we think about". Say what changed and for whom.

**Vague sources.** Always out: "experts say", "studies show", "industry reports suggest", "many teams find". Name the source from the input, or speak from the author's own experience ("I've seen..."), or cut the sentence.

**Hedging disclaimers.** Always out: "While results may vary...", "It's important to remember that every organization is different". The voice is confident. If a real caveat matters, state it in specific terms: "This works for tables over about a billion rows. Below that, the clustering cost can outweigh the savings."

**Feelings the input doesn't show.** Out unless the author's input expresses them: "I'm humbled", "I'm thrilled", "a humbling moment", "incredibly proud". When the input does, say it in the author's plain words.

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

**Openings.** Always out: "In today's data-driven world...", "Data is the new oil", "As data engineers, we all know...", a dictionary definition, or a question. Open with the concrete situation, the number, or a direct "If you..." to the reader.

**Closings.** Always out: a summary of what the post just said, a "Despite these challenges..." outlook paragraph, an abstract noun phrase with a halo ("a new chapter in our data journey", "the future of data is bright"), and "In conclusion". End on the last concrete point.

## Punctuation and format

**Em-dashes.** Always out, in every format. Readers now treat them as a sign of machine writing. Replace each with a comma, a colon, parentheses, or two sentences. Also don't use a spaced hyphen or en-dash as a dash ("the bill - which was huge - dropped").

**Bold.** Always out in a LinkedIn post (it doesn't render). In a blog post, out beyond one bold phrase, and always out as a bold label at the start of every list item or paragraph.

**Headers.** Always out in a LinkedIn post. In a blog post, follow the header rule in SKILL.md, Step 4.

**Colons before every list.** Out when repeated. "Here's what we did:" followed by bullets, again and again through a post, is a template. Use prose where the items connect to each other, and a list only where they are truly separate.

## Facts

**Invented details.** Always out. No number, percentage, dollar amount, date, client, company, tool, quote, or result that isn't in the input. This includes made-up but "plausible" statistics such as "studies show 60% of data teams...". If the sentence needs a fact you don't have, rewrite it without the fact, or ask the author.

## Small slips to fix

These turn up in real posts, including the practitioner post quoted in `references/voice.md`. Fix them in your own draft and in the author's.

- No space before an opening parenthesis ("suspects(perhaps"). Write "suspects (perhaps".
- "set-up" as a verb. "Set up" is the verb, "setup" is the noun.
- List items in mixed shapes ("Make sure you..." next to "Kill..."). Pick one shape: "Partition or cluster your large tables."
- Agreement slips: "much of those expenses" should be "many of those expenses".
- "20-30 minutes" in prose. Write "20 to 30 minutes".
- Filler such as "then" after an "If" clause, "likely", "please do".
