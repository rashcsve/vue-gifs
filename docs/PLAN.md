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

- [ ] **9.** HTTP layer: return a typed result (`{ ok, data } | { ok: false, error }`) instead of `null`, and abort in-flight requests when the route changes or a new search starts. Needs: 6.
- [ ] **10.** Replace the shared store with a `usePaginatedGifs(category)` composable, or one store per page. No state leaks between pages. Needs: 9.
- [ ] **11.** Component cleanup: `<img loading="lazy" :alt>`, one infinite-scroll sentinel, `RouteName` in `App.vue`, fix Tailwind tokens and classes, drop the `keyOf` cast. Needs: 6, 8b.
- [ ] **12.** Search: keep the query in the URL (`?q=`), extract a `useDebounce` composable, and make Escape cancel the debounce. Needs: 10.

## Phase 4: Interview polish

- [ ] **13.** Move the API key behind a serverless proxy (Netlify or Vercel function). Remove it from the client env. No blockers: do it early, since every build (including `dist/`) inlines the key today.
- [ ] **14.** Add Playwright end-to-end tests for trends loading, search and infinite scroll. Needs: 8b, 12.
- [ ] **15.** Accessibility pass (focus states, alt text, live regions) and a Lighthouse check. Needs: 11.
- [ ] **16.** Rewrite the README: architecture diagram, decisions and trade-offs, how AI tools were used (Claude Code + Codex setup from `AGENTS.md`), demo link. Needs: 17.
- [ ] **17.** Deploy, with a preview link for each PR. Needs: 7, 13.

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
- `src/store/index.ts:68`: `firstPage` is derived from `!next.value`, and the `catch` sets `next = null`, so retrying after a failed load-more replaces every loaded GIF with page 1. The spec "sets "Failed to load GIFs." and next null when the API rejects" pins the current behaviour; step 10 should change it deliberately. Found in 6.
- `src/store/index.ts:81`: unneeded `as GifsResponse | null` cast (`fetchGifsFromApi` already returns that type), and `data.results ?? []` at line 90 is dead after the `Array.isArray` check. Step 10. Found in 6.
- `src/services/giphy.ts:11`: `buildUrl` and `normalize` are exported for tests, so they also leak through the `export *` barrel in `src/services/index.ts`. Narrow the barrel in step 9. Found in 6.
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
- `.mcp.json`: the server needs Google Chrome installed. Machines without it (and Docker/CI) need `--browser chromium` plus a Playwright browser install, which the agent sandbox can't download. Revisit in step 14. Found in 8b.
- `src/views/SearchView.vue:106`, `src/store/index.ts:111`, `src/components/GifList.vue:55`: an empty search flickers through three states: "No results for …" on every keystroke (it reads the live `searchQuery` before anything is fetched), then "Loading…", then a red "No GIFs found." with a useless **Try again**, shown twice because `GifList` also renders `error`. Fix in step 10: the store exposes an empty flag instead of using `error` for "no results", the view shows the empty message only for the fetched query, and one component owns each message. Changes the spec "sets "No GIFs found." for an empty first page". Found in 9.
- `src/services/giphy.ts:54`: `fetchGifsFromApi` returns a `Result` but can still reject: a 200 with a malformed body (no `pagination`/`images`) makes `normalize` throw, and only the store's `catch` hides it. `getJson`'s `await res.json()` also flows `any` into `T` unchecked. Fix with runtime validation (`unknown` + a type guard) and new tests. Found in 9.
- `src/services/giphy.ts:81`, `src/store/index.ts:99`: a missing API key is logged twice, and every error kind shows the same retryable "Failed to load GIFs.", even `config`, where retrying can't help. `{ kind: 'invalid' }` also covers both a caller bug (no category) and a malformed response. Show per-kind messages in step 10 or 15. Found in 9.
- `src/views/TrendsView.vue:35`, `src/views/SearchView.vue:73`: `onBeforeUnmount → cancel()` is wired by hand in each view and has no test. Step 10's composable can register it once with `onScopeDispose`; step 14 e2e can cover it. Found in 9.
- `src/store/index.spec.ts`: "sets "Failed to load GIFs." … when the API rejects" and `$reset` "clears all state" don't stub `console.error`, so the store's new `[gifs] fetch threw:` log prints in test output. Cosmetic. Found in 9.
