# Language Pack: React

Load **in addition to** `references/javascript-typescript.md` when the scope contains `.jsx`/`.tsx` React components or hooks. This pack adds React-specific footguns on top of the JS/TS pack; read both before scoring.

## Idiom

- Function components + hooks (not class components in new code). Hooks called unconditionally at the top level (Rules of Hooks). Components named `PascalCase`, hooks named `useX`.
- Derived state computed during render, not mirrored into `useState` + `useEffect`.

## Security (×2.0)

- `dangerouslySetInnerHTML` with unsanitized content (XSS) — flag every occurrence and demand a sanitizer (DOMPurify) or justification.
- User-controlled `href`/`src` allowing `javascript:` URLs; rendering untrusted markdown/HTML without sanitization.
- Secrets in client-bundled env vars (`NEXT_PUBLIC_*`, `VITE_*`, CRA `REACT_APP_*`) — these ship to the browser.

## Correctness & Hidden Bugs (×2.0)

- **`useEffect` dependency array:** missing deps (stale closure reading old props/state); a function/object/array dep recreated every render (effect fires every render — needs `useCallback`/`useMemo` or a move out of render); empty `[]` when the effect actually depends on a prop.
- **Stale closures:** an event handler or interval capturing the first render's state; setInterval reading stale state instead of the `setState(prev => ...)` updater form.
- **Missing cleanup:** `useEffect` that subscribes/sets a timer/opens a socket without returning a cleanup → leak + "setState on unmounted component"; a fetch in an effect with no abort on unmount (race: late response overwrites newer state).
- **Keys:** array index as `key` on a reorderable/filterable list (state attaches to the wrong row); missing `key`.
- **Direct state mutation:** `state.push(x); setState(state)` — same reference, no re-render; mutating props.
- **Conditional/looped hook calls** (violates Rules of Hooks — runtime breakage).
- Setting state in render (infinite loop); reading a ref's `.current` during render for render-affecting data.
- Race in concurrent fetches where the slower response wins (no request-id/abort guard).

## Performance (×1.5)

- Inline object/array/function props causing children to re-render every time (when the child is memoized or the cost is real); missing `React.memo`/`useMemo`/`useCallback` where a profiler would show waste — **but** flag as a proposal, not a mandate; premature memoization is its own smell.
- Expensive computation in render not memoized; large lists without virtualization.
- `useEffect` doing work on every render due to an unstable dependency.
- Context value as an inline object re-rendering all consumers each render.

## Architecture & Design (×1.5)

React is component/hook-based rather than class-based; the relevant lens is single-responsibility and composition (the "S" and dependency-inversion spirit of SOLID), not inheritance hierarchies.

- God components doing fetching + business logic + presentation; should split into a container/hook + presentational component.
- Business logic duplicated across components instead of a shared custom hook; prop drilling many levels where context or composition fits.
- Effects used as a substitute for event handlers (deriving state in an effect that should be computed inline or set in the handler).

## Error Handling & Resilience (×1.0)

- No error boundary around a subtree that can throw during render; fetch in an effect with no error/loading state (silent blank UI on failure).
- Swallowed fetch errors leaving the user on a spinner forever; no retry on a transient data fetch where the rest of the app assumes data is present.

## Readability & Style (×1.0)

- Components >~200 lines mixing concerns; deeply nested conditional JSX where early returns / extracted components read cleaner.
- Boolean-prop soup instead of a variant prop; magic strings for variants.
- Missing types on component props (with the JS/TS pack loaded, this rolls up under TS typing).

## Grep patterns worth running

```
dangerouslySetInnerHTML       # XSS surface
useEffect\(                    # check dep arrays + cleanup
key=\{.*index                  # index-as-key on dynamic lists
\.push\(|\.splice\(            # possible direct state mutation
NEXT_PUBLIC_|VITE_|REACT_APP_  # client-exposed env vars
```

## Calibration hints

- A `useEffect` that subscribes/opens a resource with no cleanup is **High** under Correctness/Error Handling — it leaks and can setState after unmount.
- A stale-closure bug in a handler that silently uses old state is **High** (silent-wrong-behavior).
- Index-as-key on a reorderable list is **High** when row state exists (wrong-row bugs), Medium on a static list.
- Missing memoization is usually **Low/Medium** and a *proposal* — don't inflate it; React is fast and premature memo adds noise.
