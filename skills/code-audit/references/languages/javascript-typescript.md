# Language Pack: JavaScript / TypeScript

Load when the review scope contains `.js`, `.ts`, `.mjs`, `.cjs`, or a Node `package.json` (non-React). For `.jsx`/`.tsx`, load this **and** `react.md`. This pack sharpens the universal review dimensions; the dimension keys in parentheses match `review-dimensions.md`. Read it fully before scoring.

## Idiom & formatter

- Prettier + ESLint. `const`/`let`, never `var`. Strict equality `===`/`!==`. ES modules over CommonJS in new code.
- TypeScript: `strict` mode on; explicit return types on exported functions; avoid `any` (prefer `unknown` + narrowing); avoid non-null `!` assertions that paper over a real nullability question.

## Security (`security`)

- `eval`, `new Function`, or `child_process.exec` with interpolated input (command injection).
- `innerHTML`/`dangerouslySetInnerHTML`/`document.write` on untrusted data (XSS); building SQL/HTML by string concat.
- Secrets hardcoded or shipped to the client bundle (anything in client code or `NEXT_PUBLIC_*`/`VITE_*` is public); `process.env` secrets logged.
- `https` agent with `rejectUnauthorized: false`; prototype pollution via unguarded `Object.assign`/merge of untrusted input.

## Correctness & hidden bugs (`correctness`, `concurrency`)

- **`==` vs `===`** coercion bugs (`0 == ""`, `null == undefined`, `[] == false`).
- **Null/undefined:** unguarded property access; `??` vs `||` confusion (`||` treats `0`/`""`/`false` as absent); optional chaining swallowing an error that should surface.
- **Async footguns** (`concurrency`): unawaited Promise (floating promise — runs but errors are unhandled); `forEach(async ...)` (does not await); `await` inside a loop that should be `Promise.all`; mixing callbacks and promises; an `async` function with no `try/catch` whose rejection becomes an unhandledRejection.
- **`this` binding** lost when passing a method as a callback; arrow vs function `this` semantics.
- **Closures over loop variables** with `var` (use `let`/`const`).
- Floating-point money math; `parseInt` without radix; `JSON.parse` without a try/catch on untrusted input.
- Mutating a shared object/array passed by reference; `Array.sort` mutating in place; date handling via `new Date()` parsing ambiguous strings.
- TS-specific: an unsound cast (`as Foo`) hiding a real shape mismatch; `any` defeating the type checker at a trust boundary.

## Performance (`performance`)

- `await` in a loop serializing independent I/O (should be `Promise.all`/`allSettled`); N+1 network/DB calls.
- Unbounded in-memory accumulation of a stream/large response instead of streaming.
- Repeated work in a hot path (recompiling regex, rebuilding a map per call); blocking the event loop with synchronous CPU work or `fs.*Sync` in a server.
- Large dependency pulled in for a one-liner (bundle weight, client side).

## Architecture & design (`architecture`, `api-contracts`)

JS/TS supports OO and functional styles; apply the **SOLID** lens to class-based code, and the same single-responsibility / dependency-inversion spirit to module-and-function code.

- God modules; classes/functions constructing their own HTTP/DB clients with no injection seam.
- Circular imports; business logic in route handlers instead of a service layer.
- Barrel-file import cycles; default-export sprawl making refactors hard.
- Public API breaks (`api-contracts`, diff scope): changed exported function signatures, changed return types, removed exports.

## Error handling & resilience (`error-handling`, `observability`)

- `catch (e) {}` swallowing errors; catching then logging without rethrowing/handling; `catch` that loses the stack by throwing a new bare `Error(string)`.
- No retry/backoff on a flaky network call, or retrying non-transient (4xx) responses.
- Unhandled promise rejections; no per-item isolation in a batch `Promise.all` (one rejection aborts all — use `allSettled` when partial success is acceptable).
- Observability (`observability`): error messages omitting the failing identifier; `console.log` instead of a structured logger in production.

## Readability & style (`readability`)

- `any` where a real type is known; missing return types on exported functions; non-null `!` assertions hiding nullability.
- Magic numbers/strings; functions >50 lines; deeply nested callbacks where async/await reads cleaner.
- Inconsistent `==`/`===`; `var`; string concatenation where template literals read better.

## Grep patterns worth running

```
== |!= |== null            # loose equality
var                        # legacy declarations
eval\(|new Function        # injection surface
innerHTML|dangerouslySetInnerHTML   # XSS surface
rejectUnauthorized: false  # disabled TLS
\.forEach\(async           # async-in-forEach (not awaited)
catch \(.*\) \{\}          # swallowed errors
 as any| any[;,)]          # type-system escape hatches
console\.log               # debug logging in prod
```

## Calibration hints

- A floating (unawaited) promise whose rejection is never handled is at least **high** under `concurrency` — it's a fire-and-forget with unobserved failures.
- `await` in a loop over independent calls is a **`performance`** finding, usually medium unless it's on a hot path or large N (then high).
- A loose `==` at a trust boundary (auth check, parsing) is **high**; elsewhere it's medium/low.
- `as any`/non-null `!` at a trust boundary that hides a real nullability bug is **high** under `correctness`, not just a style nit.
