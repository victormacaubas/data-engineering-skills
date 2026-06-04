# Language Pack: JavaScript / TypeScript

Load when the review scope contains `.js`, `.ts`, `.mjs`, `.cjs`, or a Node `package.json` (non-React). For `.jsx`/`.tsx`, load this **and** `references/react.md`. This pack sharpens the six generic rubric dimensions; read it fully before scoring.

## Idiom & formatter

- Prettier + ESLint. `const`/`let`, never `var`. Strict equality `===`/`!==`. ES modules over CommonJS in new code.
- TypeScript: `strict` mode on; explicit return types on exported functions; avoid `any` (prefer `unknown` + narrowing); avoid non-null `!` assertions that paper over a real nullability question.

## Security (×2.0)

- `eval`, `new Function`, or `child_process.exec` with interpolated input (command injection).
- `innerHTML`/`dangerouslySetInnerHTML`/`document.write` on untrusted data (XSS); building SQL/HTML by string concat.
- Secrets hardcoded or shipped to the client bundle (anything in client code or `NEXT_PUBLIC_*`/`VITE_*` is public); `process.env` secrets logged.
- `https` agent with `rejectUnauthorized: false`; prototype pollution via unguarded `Object.assign`/merge of untrusted input.

## Correctness & Hidden Bugs (×2.0)

- **`==` vs `===`** coercion bugs (`0 == ""`, `null == undefined`, `[] == false`).
- **Null/undefined:** unguarded property access; `??` vs `||` confusion (`||` treats `0`/`""`/`false` as absent); optional chaining swallowing an error that should surface.
- **Async footguns:** unawaited Promise (floating promise — runs but errors are unhandled); `forEach(async ...)` (does not await); `await` inside a loop that should be `Promise.all`; mixing callbacks and promises; an `async` function with no `try/catch` whose rejection becomes an unhandledRejection.
- **`this` binding** lost when passing a method as a callback; arrow vs function `this` semantics.
- **Closures over loop variables** with `var` (use `let`/`const`).
- Floating-point money math; `parseInt` without radix; `JSON.parse` without a try/catch on untrusted input.
- Mutating a shared object/array passed by reference; `Array.sort` mutating in place; date handling via `new Date()` parsing ambiguous strings.
- TS-specific: an unsound cast (`as Foo`) hiding a real shape mismatch; `any` defeating the type checker at a trust boundary.

## Performance (×1.5)

- `await` in a loop serializing independent I/O (should be `Promise.all`/`allSettled`); N+1 network/DB calls.
- Unbounded in-memory accumulation of a stream/large response instead of streaming.
- Repeated work in a hot path (recompiling regex, rebuilding a map per call); blocking the event loop with synchronous CPU work or `fs.*Sync` in a server.
- Large dependency pulled in for a one-liner (bundle weight, client side).

## Architecture & Design (×1.5)

JS/TS supports OO and functional styles; apply the **SOLID** lens to class-based code, and the same single-responsibility / dependency-inversion spirit to module-and-function code.

- God modules; classes/functions constructing their own HTTP/DB clients with no injection seam.
- Circular imports; business logic in route handlers instead of a service layer.
- Barrel-file import cycles; default-export sprawl making refactors hard.
- Public API breaks (diff scope): changed exported function signatures, changed return types, removed exports.

## Error Handling & Resilience (×1.0)

- `catch (e) {}` swallowing errors; catching then logging without rethrowing/handling; `catch` that loses the stack by throwing a new bare `Error(string)`.
- No retry/backoff on a flaky network call, or retrying non-transient (4xx) responses.
- Unhandled promise rejections; no per-item isolation in a batch `Promise.all` (one rejection aborts all — use `allSettled` when partial success is acceptable).
- Error messages omitting the failing identifier; `console.log` instead of a structured logger in production.

## Readability & Style (×1.0)

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

- A floating (unawaited) promise whose rejection is never handled is at least **High** under Correctness — it's a fire-and-forget with unobserved failures.
- `await` in a loop over independent calls is a **Performance** finding, usually Medium unless it's on a hot path or large N (then High).
- A loose `==` at a trust boundary (auth check, parsing) is **High**; elsewhere it's Medium/Low.
- `as any`/non-null `!` at a trust boundary that hides a real nullability bug is **High** under Correctness, not just a style nit.
