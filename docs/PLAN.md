# Project Plan: vue-gifs → interview-ready

Source of truth for agents (Claude Code, Codex). Pick the next step whose `Needs:` are done. Tick `[x]` when a step is merged.

Stack, conventions and working rules live in `AGENTS.md`.

## Known issues (baseline)

| Area         | Issue                                                                                                                      | Fixed in |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| Tooling      | `lint` / `lint:check` use `--ignore-path`, which ESLint 9 rejects; `eslint.config.js` crashes (`vue.parsers` is undefined) | 5a       |
| Tooling      | No tests, CI, Docker or pre-commit hooks                                                                                   | 5b–8     |
| Security     | The GIPHY key ships in the client bundle                                                                                   | 13       |
| Architecture | Trends and search pages share one store, so state leaks between them                                                       | 10       |
| Architecture | `getJson` returns `null` on errors, which hides them                                                                       | 9        |
| Architecture | `AbortSignal` is passed through but never used, so stale requests aren't cancelled                                         | 9        |
| Components   | GIFs use CSS `background-image`, so no lazy loading and weak alt text                                                      | 11       |
| Components   | `App.vue` hardcodes route names (should use `RouteName`) and repeats `max-w`/`mx-auto`                                     | 11       |
| Components   | Tailwind tokens `text-text` and `border-dividerDark2` may not be defined                                                   | 11       |
| Components   | Unneeded `keyOf` cast in `GifList.vue`                                                                                     | 11       |
| Search       | Escape doesn't cancel the pending debounce; query isn't in the URL                                                         | 12       |

## Phase 0: Finish open work

- [x] **1.** Review and commit the uncommitted Tenor → GIPHY migration.

## Phase 1: AI assistant setup

- [x] **2.** Shared instructions in `AGENTS.md` (stack, commands, conventions, rules). `CLAUDE.md` imports it with `@AGENTS.md`.
- [x] **3.** Add `.claude/settings.json` and `.codex/config.toml` (permissions and sandbox), `reviewer` and `test-writer` agents for both tools, and the `next-step` and `verify` skills in `.agents/skills/` (symlinked into `.claude/skills/`).
- [x] **4.** Add a Stop hook for both tools that runs typecheck once per turn when `.ts`/`.vue` files changed (`scripts/ai/typecheck-on-stop.sh`).

## Phase 2: Safety net

Steps can run in any order once their `Needs:` steps are ticked; steps with no `Needs:` are independent.

- [x] **5a.** Fix the lint scripts for ESLint 9 and the `eslint.config.js` crash. Turn on `@typescript-eslint/no-explicit-any`. Remove the "lint is broken" notes from `AGENTS.md` and the `verify` skill.
- [x] **5b.** Add Prettier, husky, lint-staged and commitlint (Conventional Commits). Add an `npm run verify` script (typecheck, lint, test, build) that the `verify` skill, husky and CI all call. Needs: 5a.
- [x] **5c.** Add a per-edit ESLint/Prettier hook for Claude (`PostToolUse`, matcher `Edit|Write`) and Codex (`PostToolUse`, matcher `apply_patch`). Needs: 5b.
- [x] **6.** Add Vitest, `@vue/test-utils` and jsdom. First tests: `normalize`, `buildUrl` (giphy service) and the `fetchGifs` store action (first page, load more, race guard).
- [x] **7.** Add a GitHub Actions workflow that runs `npm run verify` on push and PR. Optional: AI PR review with `anthropics/claude-code-action@v1`. Needs: 5b, 6.
- [x] **8.** Add a `Dockerfile` and `docker-compose.yml` (dev on port 5173, preview on port 4173).
- [x] **8b.** Give agents eyes: a Playwright MCP server in `.mcp.json` (Claude) and `.codex/config.toml` (Codex) so they can check the UI in a browser before the UI steps.

## Phase 3: Refactor (one PR per step)

- [x] **9.** HTTP layer: return a typed result (`{ ok, data } | { ok: false, error }`) instead of `null`, and abort in-flight requests when the route changes or a new search starts. Needs: 6.
- [x] **10.** Replace the shared store with a `usePaginatedGifs(category)` composable, or one store per page. No state leaks between pages. Needs: 9.
- [x] **11.** Component cleanup: `<img loading="lazy" :alt>`, one infinite-scroll sentinel, `RouteName` in `App.vue`, fix Tailwind tokens and classes, drop the `keyOf` cast. Needs: 6, 8b.
- [x] **12.** Search: keep the query in the URL (`?q=`), extract a `useDebounce` composable, and make Escape cancel the debounce. Needs: 10.

## Phase 4: Interview polish

- [x] **13.** Move the API key behind a serverless proxy (Netlify or Vercel function). Remove it from the client env. No blockers: do it early, since every build (including `dist/`) inlines the key today.
- [x] **14.** Add Playwright end-to-end tests for trends loading, search and infinite scroll. Needs: 8b, 12.
- [x] **15.** Accessibility pass (focus states, alt text, live regions) and a Lighthouse check. Needs: 11.
- [ ] **16.** Rewrite the README: architecture diagram, decisions and trade-offs, how AI tools were used (Claude Code + Codex setup from `AGENTS.md`), demo link. Needs: 17.
- [x] **17.** Deploy, with a preview link for each PR. Needs: 7, 13.

## Found issues

<!-- Agents: add anything out of scope you discover here, with the file and line. -->

- `eslint.config.js:18`: `ignores` is copied by hand from `.gitignore` and leaves out `logs`, `*.log` and `cypress/`, so it will drift. Fix with `includeIgnoreFile` from `@eslint/compat` (new dependency, needs approval). Found in 5a.
- `src/store/index.ts:105`: `catch {}` swallows the error with no logging, so every failure becomes the generic "Failed to load GIFs.". Covered by step 9. Found in 5a.
- `package.json:20`: `"prepare": "husky"` fails on installs without devDependencies (`npm ci --omit=dev`), so the step 8 Dockerfile's prod stage needs `--ignore-scripts` or `"husky || true"`. Found in 5b. Docker (8) sidesteps it with `ENV HUSKY=0` and keeps devDependencies; still applies to any future `--omit=dev` install.
- `package.json:7`: `engines.node` is now `>=22.12.0` (commitlint 21 needs it; lint-staged is pinned to 16 because 17 needs 22.22.1). `.nvmrc` (22.19.0) now pins Node for CI (7); use it in the Docker step (8) too. Found in 5b. Done in 8 (`node:22.19.0-alpine`).
- `package-lock.json`: `npm audit` reports 25 vulnerabilities (1 critical in `tar`, high in `vite`, `vue`, `postcss`, `rollup`, `@typescript-eslint/*`). All pre-date 5b (same count on the old lockfile). Needs its own dependency-upgrade step. Found in 5b.
- `package.json:18`: `verify` type-checks twice (`typecheck` runs `vue-tsc --noEmit`, then `build` runs `vue-tsc -b`). Fine for now; revisit if pre-push gets slow. Found in 5b.
- `scripts/ai/lint-on-edit.sh`: each edit starts a fresh ESLint (typescript-eslint + vue parser) and Prettier with no `--cache`. Fine for now; add caching (and gitignore `.eslintcache`) if per-edit hooks get slow. Found in 5c.
- `.codex/hooks.json`: both hooks locate the script with `$(git rev-parse --show-toplevel)`, which is empty outside a git repo and gives a "No such file" error. Only matters if the repo is used without `.git` (e.g. a tarball). Found in 5c.
- `scripts/ai/`: the hook scripts have no automated tests. Consider bats or a small Vitest spec that pipes sample payloads in once step 6 lands. Found in 5c.
- `src/store/index.ts:68`: `firstPage` is derived from `!next.value`, and the `catch` sets `next = null`, so retrying after a failed load-more replaces every loaded GIF with page 1. The spec "sets "Failed to load GIFs." and next null when the API rejects" pins the current behaviour; step 10 should change it deliberately. Found in 6. Done in 10 (a failed load-more keeps GIFs and `next`; `retry()` repeats it).
- `src/store/index.ts:81`: unneeded `as GifsResponse | null` cast (`fetchGifsFromApi` already returns that type), and `data.results ?? []` at line 90 is dead after the `Array.isArray` check. Step 10. Found in 6. Done in 10 (store deleted).
- `src/services/giphy.ts:11`: `buildUrl` and `normalize` are exported for tests, so they also leak through the `export *` barrel in `src/services/index.ts`. Narrow the barrel in step 9. Found in 6. Done: the barrel only re-exports `fetchGifsFromApi`, and step 13 moved `buildUrl` to the server as `buildGiphyUrl`.
- `vite.config.ts`: not covered by any tsconfig, so the `test` block is never type-checked. Add a `tsconfig.node.json` (or similar). Found in 6.
- `tsconfig.tsbuildinfo` is tracked, and every `npm run build` (`vue-tsc -b`) rewrites it. Untrack it and add it to `.gitignore`. Found in 6.
- `node_modules/nopt`, `abbrev` (via `@vue/test-utils` → `js-beautify`) declare Node `^22.22.2`, giving an EBADENGINE warning on Node 22.19. Harmless (CLI-only deps); also shows in CI, since `.nvmrc` pins 22.19.0; goes away if `.nvmrc` moves to 22.22.2+. Found in 6.
- `vite.config.ts`: `test.environment` is `jsdom` globally, which adds ~1s per run for logic-only specs. Switch the default to `node` with per-file `// @vitest-environment jsdom` if the suite gets slow. Found in 6.
- `~/.npm` cache: the agent sandbox can only write `~/.npm/_logs`, so agent installs need `npm_config_cache=$TMPDIR/npm-cache`. Found in 6.
- `.github/workflows/ci.yml:20`: `actions/checkout` and `actions/setup-node` use floating major tags (`@v6`). Pin them to commit SHAs (with a `# v6.x.y` comment) and let Dependabot bump them. Found in 7.
- `.github/workflows/ci.yml`: commitlint only runs in the local husky `commit-msg` hook, so `--no-verify` commits and commits made in the GitHub web UI skip it. Add a `commitlint --from <base> --to <head>` step on `pull_request`. Found in 7.
- `.github/workflows/ci.yml`: the optional AI PR review (`anthropics/claude-code-action@v1`) from step 7 isn't added yet. It needs an `ANTHROPIC_API_KEY` repo secret. Found in 7.
- `Dockerfile:4`: the image tag `node:22.19.0-alpine` duplicates `.nvmrc` by hand, so the two can drift. Docker Scout also reports 6 critical and 60 high vulnerabilities in that image. Bump `.nvmrc` and the tag together (22.22.2+ also clears the EBADENGINE warning), and consider a check that keeps them in sync. Found in 8.
- `Dockerfile:15`: the dev container runs as root on a bind mount, so on Linux hosts files Vite writes into the checkout (e.g. `vite.config.ts.timestamp-*.mjs`) are root-owned. Fix with `USER node` plus `chown` of `/app` and the `node_modules` volume. Untested because the Docker daemon wasn't running. Found in 8.
- `docker-compose.yml:17`: the anonymous `node_modules` volume only refreshes with `-V` (`--renew-anon-volumes`). Consider Compose `develop.watch` with `action: rebuild` on `package-lock.json` to remove the footgun. Found in 8.
- `.claude/settings.json`: `browser_navigate` is allowed and the Playwright MCP server runs outside the Bash sandbox's network allowlist, so an agent can browse any URL without asking. (`browser_evaluate`, `run_code_unsafe`, `file_upload` and `drop` are `ask`.) Found in 8b.
- `.claude/settings.json`: `enabledMcpjsonServers` auto-starts `npx -y @playwright/mcp@0.0.83` for anyone who opens the repo in Claude Code, while `Bash(npx *)` is `ask`. The exact version pin limits the risk. Found in 8b.
- `.mcp.json`, `.codex/config.toml`: the `@playwright/mcp` version is pinned in both files by hand, so they can drift. Found in 8b.
- `.mcp.json`: the server needs Google Chrome installed. Machines without it (and Docker/CI) need `--browser chromium` plus a Playwright browser install, which the agent sandbox can't download. Revisit in step 14. Found in 8b. Still open after 14: the e2e suite solves it for itself (`channel: 'chrome'` locally, `playwright install chromium` in CI), but `.mcp.json` is unchanged.
- `src/views/SearchView.vue:106`, `src/store/index.ts:111`, `src/components/GifList.vue:55`: an empty search flickers through three states: "No results for …" on every keystroke (it reads the live `searchQuery` before anything is fetched), then "Loading…", then a red "No GIFs found." with a useless **Try again**, shown twice because `GifList` also renders `error`. Fix in step 10: the store exposes an empty flag instead of using `error` for "no results", the view shows the empty message only for the fetched query, and one component owns each message. Changes the spec "sets "No GIFs found." for an empty first page". Found in 9. Done in 10 (`isEmpty` + fetched `query`; `GifList` renders no errors; pinned in `SearchView.spec.ts`).
- `src/services/giphy.ts:54`: `fetchGifsFromApi` returns a `Result` but can still reject: a 200 with a malformed body (no `pagination`/`images`) makes `normalize` throw, and only the store's `catch` hides it. `getJson`'s `await res.json()` also flows `any` into `T` unchecked. Fix with runtime validation (`unknown` + a type guard) and new tests. Found in 9.
- `src/services/giphy.ts:87`, `src/composables/usePaginatedGifs.ts:96`: a missing API key is logged twice, and every error kind shows the same retryable "Failed to load GIFs.", even `config`, where retrying can't help. `{ kind: 'invalid' }` also covers both a caller bug (no category) and a malformed response. Show per-kind messages (not done in 10 or 15). Found in 9. Since 13 the client has no `config` kind: a missing server key is a 500 from `/api/gifs` (logged by the function), shown as the generic retryable error.
- `src/views/TrendsView.vue:35`, `src/views/SearchView.vue:73`: `onBeforeUnmount → cancel()` is wired by hand in each view and has no test. Step 10's composable can register it once with `onScopeDispose`; step 14 e2e can cover it. Found in 9. Done in 10 (`onScopeDispose(cancel)`, tested in the composable and view specs).
- `src/store/index.spec.ts`: "sets "Failed to load GIFs." … when the API rejects" and `$reset` "clears all state" don't stub `console.error`, so the store's new `[gifs] fetch threw:` log prints in test output. Cosmetic. Found in 9. Done in 10 (spec deleted; the new specs stub `console.error`).
- `src/components/GifList.vue:30`: the sentinel item is `unobserve`d before `load-more` is emitted and `GifItem` only calls `observe()` in `onMounted`, so after a failed load-more infinite scroll stops, and the **Try again** button sits above the list, out of view. Mounting `GifList` with GIFs already present also never observes the last item (the observer is created after the children mount). Fix with the single sentinel in step 11 (re-observe when loading ends), and consider a retry near the bottom of the list in step 15. Found in 10. Done in 11 (one sentinel, observed by a watcher while `canLoadMore`; a failed load-more pauses it via `:paused="!!error"` until **Try again**, so it can't retry in a loop). Done in 15 (a load-more error and its **Try again** render below the list; retrying moves focus to the list).
- `src/composables/usePaginatedGifs.ts:95`: an `{ kind: 'aborted' }` result for the current request (an `AbortError` the composable didn't cause) returns silently, leaving a blank page with no error and no retry. Treat it as a failure unless our own signal was aborted. Changes the specs "does not log or set isEmpty for an aborted result" and "sets no error and keeps gifs when a load-more result is aborted", so it needs approval. Found in 10.
- `src/main.ts:10`, `package.json:32`: Pinia is still installed and registered, but no store is left after step 10. Remove it (and the README mention) or keep it for future shared state. Found in 10.
- `src/views/*.spec.ts`: the loading texts, the disabled **Try again** while loading, Trends load-more and input autofocus have no view-level tests. Step 14 e2e can cover them. Found in 10. Partly done in 14 (Trends load-more and autofocus); the loading texts and the disabled **Try again** need a way to hold a mocked response.
- `src/assets/base.css:58`: the `*` rule (`font-weight: normal; position: relative`) is unlayered, so it beats every Tailwind utility (utilities live in `@layer utilities`). `font-semibold`/`font-bold` are no-ops app-wide (nav active link, every `h1`), and the active link colour only works because of `!`. Fix by importing it as `@import './base.css' layer(base);` (or wrapping it in `@layer base`), drop the global `position: relative`, then remove the `!` in `App.vue`. App-wide visual change, so its own step (or 15). Found in 11. Partly done in 15: `position: relative` is dropped (it broke `sr-only` on the skip link); the unlayered `font-weight: normal` and the `!` remain.
- `src/composables/usePaginatedGifs.ts`: GIPHY offset pagination can return the same GIF on consecutive pages (trending shifts between requests), giving duplicate `:key="gif.id"` in `GifList` and Vue "Duplicate keys" warnings. Not new (the old `keyOf` also keyed by `id`). De-duplicate by id when appending a page; needs a spec. Found in 11.
- `src/components/GifList.spec.ts`: the older specs "emits load-more when the last item intersects…" and "does not emit when hasMore turns false before the item intersects" still name the removed per-item design; rename to "sentinel" (user decision). In the view specs, the second `intersectAll()` after a failed load-more is a no-op with `FakeObserver` (nothing observed while paused), so the loop guard is only proven by the `EagerObserver` spec in `GifList.spec.ts`. Found in 11.
- `src/views/SearchView.vue:54`: `router.replace({ query: q ? { q } : {} })` (and Escape's `{ query: {} }`) replaces the whole query, so any other params (e.g. `utm_*`) are dropped on the first search. Merge with `route.query` and delete `q` when empty; needs a spec. Found in 12.
- `src/views/SearchView.vue:33`: `routeQuery` trims `?q=` but the URL is never rewritten, so `/search?q=%20cats%20` or `?q=%20` stays as-is after Enter (it counts as "same query"). Also untested: repeated `?q=a&q=b` (takes the first) and value-less `?q`. Found in 12.
- `src/views/SearchView.spec.ts:30`, `src/views/TrendsView.spec.ts:46`: the memory-router fixture (routes + push + `isReady`) is copied in both specs. Move a `mountWithRouter` helper into `src/test/helpers.ts`. Found in 12.
- `netlify/functions/gifs/gifs.ts`: `/api/gifs` is an open proxy. Anyone can spend the GIPHY key's quota through it (no rate limit, origin check or `q` length cap), and responses have no `Cache-Control`, so identical trending requests are never cached. Consider `Cache-Control: public, s-maxage=60` plus a Netlify rate-limit rule. Found in 13.
- `netlify/functions/gifs/gifs.ts`: the response is always labelled `content-type: application/json`, even when GIPHY returns something else (e.g. an HTML 503 from an edge). The client parses it as JSON anyway, so it ends up as a `parse` error. Found in 13.
- `netlify/functions/gifs/gifs.ts`: when the client cancels (debounce, route change), the upstream fetch rejects with `AbortError` and the function logs "GIPHY request failed" and returns 502 to nobody. Skip the log when `req.signal.aborted`; needs a spec. Found in 13.
- `vite.config.ts`: the `giphyProxy` dev/preview middleware (exact path match, `originalUrl`, abort on close, `.catch(next)`) has no automated test. Found in 13. Not covered by 14 either: the e2e specs fulfil `/api/gifs` with `page.route` in the browser, so the middleware never runs. Needs a server-side check with a stubbed upstream.
- `netlify.toml`: that a function's `config.path` (`/api/gifs`) wins over the `/* → /index.html` SPA rewrite is per Netlify's docs, but untested here. Check on the first deploy preview in step 17. Found in 13. Done in 17: on the first deploy preview, `/api/gifs?endpoint=trending` returns GIPHY JSON (no `api_key` in it) and a deep link to `/search?q=cats` loads the app.
- `netlify.toml`: Netlify only builds; it doesn't wait for CI, so a PR preview (and a `main` deploy) can go live while `verify` or e2e is failing. Fine for a demo; if it matters, turn on Netlify's "wait for GitHub checks" or deploy from the CI workflow. Found in 17.
- `npm run test:e2e`: the 16 mocked specs take ~44s locally, though the build is ~2.5s and the deliberate settles (`expectRequestCountToStay`, 700 ms × 4) only ~3s. Cause not measured (the agent sandbox can't launch Chrome); get per-test durations with `--reporter=json` and check the `page.clock` specs and worker count. Found in 14. Addressed after a code review, still unmeasured: headless shell instead of branded Chrome, `workers: '75%'`, per-case settles (`SETTLE_MS`, 3.5s → 1.3s), safety-net route limited to non-local URLs, `vite` called directly.
- `e2e/*.spec.ts`: the 800×500 viewport assumes 12 GIFs overflow it, so the first page doesn't trigger load-more on its own. Exact request-count assertions (e.g. `[{ offset: 0 }]`) break for unrelated reasons if a CSS change makes cards shorter. Found in 14.
- `.github/workflows/ci.yml`: the `e2e` job repeats `npm ci` and the build that `verify` already does, and downloads Chromium every run (cache `~/.cache/ms-playwright` keyed on the Playwright version). Cache, `--only-shell` and a separate build step added after a code review; the repeated `npm ci` and build remain. `actions/upload-artifact@v4` lags the `@v6` checkout/setup-node. Found in 14.
- `playwright.config.ts`: `reuseExistingServer: !CI` reuses anything on port 4174 locally, so a leftover `vite preview` serves a stale build. Documented in a comment; set it to `false` if it bites. Found in 14.
- `src/views/SearchView.vue`: the sr-only live region says `No results for "q"` (straight quotes) while the visible text uses curly quotes. Step 15. Found in 14. Done in 15 (`GifStatus` uses curly quotes).
- `src/views/*.vue`: each view mounts its own `GifStatus` live region, so a region that already has text when it mounts isn't announced (deep link to `/search?q=cats` skips "Loading GIFs…"), and every route change replaces the region. One persistent `role="status"` region in `App.vue`, fed by the active view, would fix it. Found in 15.
- `src/components/GifItem.vue`: GIFs autoplay with no way to pause (WCAG 2.2.2) and ignore `prefers-reduced-motion`. Serve GIPHY's `*_still` image under reduced motion (`<picture><source media="(prefers-reduced-motion: reduce)">`); needs the still URL in `normalize` and the proxy. Found in 15.
- `src/App.vue`: route changes don't move focus or announce the new page, so screen-reader users get no cue after clicking a nav link. Focus the view's `h1` (already `tabindex="-1"`) in `router.afterEach`, except on the first load and on Search (which focuses its input). Found in 15.
- `src/components/LoadError.vue`: `busy` (disables **Try again**) is never true while the error shows, since `retry()` clears `error` before loading starts. Remove it, or keep the error visible while retrying. Found in 15.
- Lighthouse (accessibility, light mode, preview build): 96 before the fixes, failing only on the faded "Powered by GIPHY" footer. Fixed in 15 with `--color-text-muted`; the active nav green (≈2.5:1, not flagged by Lighthouse) now uses `--color-accent`. Re-run after merge to record the final score. A saved `*.report.html` in the repo root is picked up by `prettier --write .`; add `*.report.html` to `.gitignore` and `.prettierignore`. Found in 15.
