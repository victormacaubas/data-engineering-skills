---
name: atlassian-cli
description: Command reference for the Atlassian CLI (`acli`) covering Jira work item reads and writes, Confluence reads, and the single-profile auth model. Use this whenever a task touches Jira or Confluence from the terminal - reading a ticket or its comments, searching with JQL, creating or editing a work item, transitioning status, assigning, linking, posting a comment, or pulling a Confluence page - and whenever an acli command errors, hangs waiting for input, or silently omits a field you asked for. Consult it before writing any acli invocation from memory, because short flags collide across subcommands, the table renderers drop fields that only `--json` returns, and several write verbs prompt for confirmation unless told not to.
---

# Atlassian CLI (`acli`)

Jira is well covered; Confluence is barely covered. Flags below are from `acli 1.3.30-stable`; check `acli <command> --help` when a flag is rejected.

## Auth: one global profile at a time

`acli` keeps a single active profile for the whole machine. Jira and Confluence typically live on different sites, so work spanning both has to switch:

```bash
acli auth switch --site <site>.atlassian.net   # always pass --site; bare `switch` goes interactive
acli auth status                               # active site and email, read-only, non-interactive
```

Two consequences worth internalising:

- **The profile is shared process state.** Another shell, another agent, or a parallel task can switch it between two of your own commands. Switch, then run your reads immediately. When a command returns not-found or unauthorized, check `acli auth status` before concluding the resource is missing or your permissions are wrong: pointing at the wrong site produces exactly the same error as a bad key.
- `acli config` has no default-site or default-project setting, so `auth switch --site` is the only account selector. There is nothing to configure once and forget.

`acli auth status` reports only the active profile. It will not enumerate every account you have logged in.

## Reading Jira

```bash
acli jira workitem view <KEY> --json
acli jira workitem view <KEY> --fields "summary,status,assignee,description,issuelinks" --json
acli jira workitem comment list --key <KEY> --limit 20 --json
acli jira workitem search --jql "project = ABC AND status = Blocked" \
  --fields "key,summary,status,assignee" --limit 20 --csv
```

**The renderers drop fields you asked for.** The default table and `--csv` print a fixed column set and silently discard everything else, so `--fields "summary,issuelinks"` renders as a table with no links at all - which reads identically to a ticket that has no links. Anything past the defaults (`description`, `comment`, `issuelinks`, custom fields) comes back only under `--json`. Quote from JSON; use the table or `--csv` for scanning a list.

`view` defaults to key, type, summary, status, assignee, and description. Widen it with an explicit `--fields` list, or `--fields "*navigable"` when you cannot predict where the answer sits. `--fields` also accepts exclusions (`"*all,-description"`).

**Bound your searches.** `--limit N` caps results; `--paginate` walks the entire result set and ignores `--limit`, which can pull a whole project into context. When a result fills the limit, re-run with `--count` to learn the true total rather than presenting the head as the whole. `comment list` and `project list` have the same `--paginate` behaviour.

Other reads: `acli jira workitem link list --key <KEY> --json`, `acli jira workitem link type` (valid link type names), `acli jira project view --key <KEY> --json`, `acli jira project list --limit 30 --json`.

## Writing Jira

Writes are outward-facing: a comment or transition is visible to the team the moment it lands, and `acli` has no undo. Show the user the exact text and the target key, get agreement, then run the command.

```bash
acli jira workitem create --project ABC --type Task --summary "..." \
  --description-file /tmp/body.txt --assignee @me --json
acli jira workitem comment create --key <KEY> --body-file /tmp/comment.txt --json
acli jira workitem edit --key <KEY> --summary "..." --description-file /tmp/body.txt --yes --json
acli jira workitem transition --key <KEY> --status "In Progress" --yes --json
acli jira workitem assign --key <KEY> --assignee @me --yes --json
acli jira workitem link create --out <KEY-1> --in <KEY-2> --type Blocks --yes
```

**Pass multi-paragraph text through a file.** Write the body to a temp file and use `--description-file` (`create`, `edit`) or `-F`/`--body-file` (`comment create`). No command documents reading body text from stdin, and there is no `-` convention. Inline `--description`/`--body` does accept multi-paragraph plain text, but shell quoting and embedded newlines are an easy way to post something mangled. Both inline and file forms accept plain text or ADF JSON; ADF is the route to rich formatting.

`create` also has `--from-file`, which supplies summary *and* description from one file in an undocumented format. Prefer an explicit `--summary` plus `--description-file` so you know what you posted.

**`--yes` matters.** `edit`, `transition`, `assign`, and `link create` prompt for confirmation by default and will hang without it. `create` and `comment create` have no `--yes` flag; `create` fails fast with a flag-group error when under-specified rather than prompting, so always supply `--key` plus a body on `comment create` and the project/type/summary trio on `create`.

**Never use the editor flags.** `--editor` on `create` and `comment create` launches `$EDITOR` and cannot work headless.

`edit`, `transition`, and `assign` accept `--jql` or `--filter <id>` instead of `--key`, which applies the write to every match. That is a bulk mutation with no dry-run - resolve the JQL with `workitem search` first and confirm the exact key list before switching the same query into a write verb.

For a structured payload, `--generate-json` emits a template you fill in and pass back via `--from-json`. It writes a file for `workitem create`/`edit` and `project create`/`update`, but prints to stdout for `link create`.

## Reading Confluence

```bash
acli confluence page view --id <page-id> --body-format storage --json
acli confluence page view --id <page-id> --include-labels --include-direct-children --json
acli confluence space list
acli confluence space view --id <space-id> --json
```

A Confluence URL carries the page ID in its `/pages/<id>/` segment; extract it rather than guessing. `page view` takes an ID only - there is no title or space lookup. `--body-format storage` returns the source markup, `view` returns rendered HTML.

Add `--include-*` toggles only when the task needs them; each enlarges a payload you then have to read.

Blogs are separate and better equipped: `acli confluence blog list --space-id <id> --limit 25 --csv`, `blog view --id <id> --json`, and `blog create --space-id <id> --title "..." --from-file <path>` (body is Confluence storage-format XHTML, not markdown).

## What `acli` cannot do

Knowing the holes prevents hunting for a flag that was never there:

- **No Confluence search.** No CQL, no title lookup, no full-text query. Without a page ID or URL you cannot find a page; `space list` resolves spaces only. Ask for the ID.
- **No Confluence page create, update, or delete.** `acli confluence page` has exactly one subcommand, `view`. Blogs can be created; pages cannot.
- **No Confluence page comments.** A decision living in a comment thread is not reachable. Say so rather than letting the page body stand in for a discussion you could not read.

## Flag traps

Short flags are reused with different meanings across subcommands, so prefer long flags in anything you write down.

| Short | Meaning depends on the command |
|---|---|
| `-j` | `--json` on `project view` and Confluence commands; `--from-json` on `jira project create`/`update`. Jira workitem commands have no short form for `--json`. |
| `-l` | `--label`/`--labels` on `workitem create`/`edit`; `--limit` on `project list` and `blog list`; `--lead-email` on `project create`/`update`. |
| `-f` | `--from-file` on `workitem create` and `assign`; `--from-project` on `project create`. |
| `-e` | `--editor` on `workitem create`; `--edit-last` on `comment create`, where the editor flag is long-only. |
| `-F` | `--body-file` on `comment create`. There is no lowercase `-f` there. |

Also worth remembering: `--json` is available on every Jira command above except `auth status` and `link create`; `--csv` output exists on `jira workitem search` and `confluence blog list`; and `link create --from-csv` is CSV *input*, not output.
