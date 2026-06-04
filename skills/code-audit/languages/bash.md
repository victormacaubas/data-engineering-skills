# Language Pack: Bash / Shell

Load when the review scope contains `.sh`, `.bash` files, a shebang `#!/bin/bash` or `#!/bin/sh`, or `Makefile`. This pack sharpens the universal review dimensions with shell-specific footguns; the dimension keys in parentheses match `../references/review-dimensions.md`. Read it fully before scoring.

## Idiom & formatter

- `shellcheck` is the canonical static analyzer. If the repo has a `.shellcheckrc` or CI runs shellcheck, align with its directives.
- Idiomatic scripts start with `set -euo pipefail` (strict mode). Absence of strict mode in a non-trivial script is a finding.
- Quote all variable expansions unless you have a specific reason not to (word-splitting is intentional). `"$var"` is the default; `$var` is the exception that requires justification.
- Use `printf '%s\n'` over `echo` for portability (echo behavior differs across shells).

## Security (`security`)

- **Command injection:** unquoted `$var` in command arguments where the value comes from user input or filenames; `eval "$user_input"`; backtick substitution with unsanitized content.
- **Temp file races:** `mktemp` without `-d` or using predictable names in `/tmp`; world-readable temp files containing secrets.
- Secrets visible in `ps` output (passed as command-line arguments instead of env vars or stdin).
- `chmod 777` or `chmod a+w` on anything.
- Piping `curl` output directly to `sh`/`bash` without integrity verification.

## Correctness & hidden bugs (`correctness`, `concurrency`, `resource-lifecycle`)

- **`set -e` traps** — commands that legitimately return non-zero in normal operation will abort the script:
  - `grep` returns 1 on no match; `grep -c` returns 1 when count is 0.
  - Commands in pipelines: only the last command's exit code matters (even with `pipefail`, intermediate failures may surprise).
  - Commands in `$()` inside `$(( ))` arithmetic or variable assignment: `set -e` does NOT trigger on failures inside `local var=$(failing_cmd)`.
  - `diff` returns 1 when files differ (expected behavior, not an error).
- **`|| true` swallowing real failures** — when used to suppress `set -e`, it also hides genuine errors. Distinguish "this command may legitimately fail" from "I'm suppressing because I'm lazy."
- **Word splitting and globbing:**
  - Unquoted `$var` in `for` loops splits on IFS (spaces, tabs, newlines). Filenames with spaces become multiple items.
  - Unquoted variable matching glob patterns (`*`, `?`, `[`) gets expanded against the filesystem.
  - `$@` vs `$*`: unquoted `$*` joins all args into one string; `"$@"` preserves individual arguments.
- **Subshell scoping:** variables set inside a pipeline (`cmd | while read ...; do VAR=x; done`) are in a subshell — `$VAR` is unchanged in the parent. Same for `( )` groups.
- **`read` pitfalls:** missing `-r` eats backslashes; missing `IFS=` trims leading/trailing whitespace; `read` in a loop consuming stdin meant for something else.
- **Hardcoded line ranges in `sed`/`awk`** (`sed -n '3,28p'`) — drift silently when lines are added/removed above the range.
- **Integer arithmetic:** `$(( ))` has no overflow detection and silently wraps on 64-bit; division by zero aborts.
- **`[ ]` vs `[[ ]]`:** `[ $var = x ]` breaks when var is empty or contains spaces (use `[[ ]]` in bash or quote inside `[ ]`).

## Performance (`performance`)

Performance is rarely a concern in shell scripts. Flag only:
- Subprocess spawning in a tight loop (e.g., calling `basename`/`dirname` per-line instead of parameter expansion `${var##*/}`).
- Repeated `grep`/`find` of the same large tree that could be piped once.
- Reading a large file line-by-line in shell when `awk`/`sed` would process it in one pass.

## Architecture & design (`architecture`, `api-contracts`)

SOLID does not apply. Frame architecture as:
- **Separation:** config/constants at the top; functions defined before use; main logic at the bottom.
- **Function decomposition:** repeated logic extracted into functions; functions are small and single-purpose.
- **Global state discipline:** minimize global variable mutation; pass values as function arguments where practical.
- **Exit codes as API:** consistent exit-code contract (0 = success, 1 = runtime error, 2 = usage error).
- **Portability:** POSIX `sh` vs bash-only features; whether the script declares its shell dependency.

## Error handling & resilience (`error-handling`, `idempotency`, `observability`)

- **Missing `trap` for cleanup:** scripts that create temp files/dirs, acquire locks, or start background processes should `trap cleanup EXIT` (or ERR/INT/TERM as appropriate).
- **`2>/dev/null` hiding diagnostics:** suppressing stderr on commands that could genuinely fail loses the error message needed to diagnose.
- **Silent fallthrough on `|| true`:** when `|| true` suppresses a command that indicates a real problem (file not found, permission denied, network unreachable), the script continues with stale or empty data. Flag when the suppressed command's failure means downstream logic operates on garbage.
- **Missing error messages:** a script that exits non-zero without printing why is undiagnosable. `log "ERROR: ..." >&2` before `exit 1`.
- **Idempotency (`idempotency`):** scripts that create directories, write files, or modify state should be safe to re-run — `mkdir -p`, `ln -sf`, check-before-write patterns.
- **Observability (`observability`):** logging to stderr (not stdout, which is data); a `--verbose`/`-v` flag or `log()` helper for debug output.

## Readability & style (`readability`)

- Functions named with verbs; variables in `lower_snake_case`; constants in `UPPER_SNAKE_CASE`.
- Usage/help text accessible via `-h`/`--help`.
- Consistent quoting style (always double-quote unless splitting is intentional).
- Magic strings/numbers extracted to named constants at the top.
- Script length: beyond ~200 lines, consider whether it should be rewritten in Python.

## Grep patterns worth running

```
\|\| true              # suppressed error — intentional or hiding a bug?
eval                   # injection surface
set \+e               # disabling strict mode mid-script — why?
rm -rf                # destructive without guard
chmod 777|chmod a\+w  # world-writable permissions
2>/dev/null           # suppressed stderr — losing diagnostics?
sed -n '[0-9].*p'     # hardcoded line ranges — will drift
\$[A-Za-z_]          # unquoted variable (check context for word-split risk)
```

## Calibration hints

- Unquoted variable in a command argument where the value could contain spaces or globs → at least **high** under `correctness` (silent wrong behavior, not a crash).
- `|| true` on a command whose failure means downstream logic operates on garbage → **high** under `error-handling`.
- `set -e` with a `grep -c` or `diff` that returns non-zero in normal operation → **medium** under `correctness` (script aborts unexpectedly, but may be guarded).
- `eval` on any variable that could contain external input → **critical** under `security`.
