# Project Plan: vue-gifs → interview-ready

Source of truth for agents (Claude Code, Codex). Pick the next step whose `Needs:` are done. Tick `[x]` when a step is merged.

Stack, conventions and working rules live in `AGENTS.md`.

## Known issues (baseline)

| Area | Issue | Fixed in |
|---|---|---|
| Tooling | `lint` / `lint:check` use `--ignore-path`, which ESLint 9 rejects; `eslint.config.js` crashes (`vue.parsers` is undefined) | 5a |
| Tooling | No tests, CI, Docker or pre-commit hooks | 5b–8 |
| Security | The GIPHY key ships in the client bundle | 13 |
| Architecture | Trends and search pages share one store, so state leaks between them | 10 |
| Architecture | `getJson` returns `null` on errors, which hides them | 9 |
| Architecture | `AbortSignal` is passed through but never used, so stale requests aren't cancelled | 9 |
| Components | GIFs use CSS `background-image`, so no lazy loading and weak alt text | 11 |
| Components | `App.vue` hardcodes route names (should use `RouteName`) and repeats `max-w`/`mx-auto` | 11 |
| Components | Tailwind tokens `text-text` and `border-dividerDark2` may not be defined | 11 |
| Components | Unneeded `keyOf` cast in `GifList.vue` | 11 |
| Search | Escape doesn't cancel the pending debounce; query isn't in the URL | 12 |

## Phase 0: Finish open work

- [x] **1.** Review and commit the uncommitted Tenor → GIPHY migration.

## Phase 1: AI assistant setup

- [x] **2.** Shared instructions in `AGENTS.md` (stack, commands, conventions, rules). `CLAUDE.md` imports it with `@AGENTS.md`.
- [x] **3.** Add `.claude/settings.json` and `.codex/config.toml` (permissions and sandbox), `reviewer` and `test-writer` agents for both tools, and the `next-step` and `verify` skills in `.agents/skills/` (symlinked into `.claude/skills/`).
- [x] **4.** Add a Stop hook for both tools that runs typecheck once per turn when `.ts`/`.vue` files changed (`scripts/ai/typecheck-on-stop.sh`).

## Phase 2: Safety net

Steps can run in any order once their `Needs:` steps are ticked; steps with no `Needs:` are independent.

- [ ] **5a.** Fix the lint scripts for ESLint 9 and the `eslint.config.js` crash. Turn on `@typescript-eslint/no-explicit-any`. Remove the "lint is broken" notes from `AGENTS.md` and the `verify` skill.
- [ ] **5b.** Add Prettier, husky, lint-staged and commitlint (Conventional Commits). Add an `npm run verify` script (typecheck, lint, test, build) that the `verify` skill, husky and CI all call. Needs: 5a.
- [ ] **5c.** Add a per-edit ESLint/Prettier hook for Claude (`PostToolUse`, matcher `Edit|Write`) and Codex (`PostToolUse`, matcher `apply_patch`). Needs: 5b.
- [ ] **6.** Add Vitest, `@vue/test-utils` and jsdom. First tests: `normalize`, `buildUrl` (giphy service) and the `fetchGifs` store action (first page, load more, race guard).
- [ ] **7.** Add a GitHub Actions workflow that runs `npm run verify` on push and PR. Optional: AI PR review with `anthropics/claude-code-action@v1`. Needs: 5b, 6.
- [ ] **8.** Add a `Dockerfile` and `docker-compose.yml` (dev on port 5173, preview on port 4173).
- [ ] **8b.** Give agents eyes: a Playwright MCP server in `.mcp.json` (Claude) and `.codex/config.toml` (Codex) so they can check the UI in a browser before the UI steps.

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
