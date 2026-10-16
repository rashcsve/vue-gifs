# vue-gifs

GIF browser (trending + search) built with Vue 3, TypeScript, Pinia, Tailwind 4 and the GIPHY API.

This file is the shared instruction source for every coding agent (Codex reads it directly; Claude Code imports it from `CLAUDE.md`).

## Commands

- `npm run dev`: start the dev server
- `npm run typecheck`: run vue-tsc
- `npm run lint:check`: run ESLint (`npm run lint` autofixes)
- `npm run format:check`: run Prettier (`npm run format` rewrites)
- `npm run build`: production build
- `npm test`: unit tests (Vitest; `npm run test:watch` for watch mode)
- `npm run verify`: every gate above in one go; husky `pre-push` and CI (`.github/workflows/ci.yml`) run the same script

## Conventions

- Vue 3 `<script setup lang="ts">`, Pinia setup stores, Tailwind v4 utility classes, `@/` imports.
- No `any` and no unneeded casts.
- Tests sit next to their source as `*.spec.ts` (Vitest, `@vue/test-utils`, jsdom). Never call the real GIPHY API in tests.
- Tests change only when expected behaviour changes, and the user decides that. Never delete, skip or loosen an assertion to go green.
- Prettier owns formatting (`.prettierrc.json`); don't hand-format against it.
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`, `style:`), enforced by commitlint in the husky `commit-msg` hook.

## Working rules

- Explore first. Before you edit, give a short plan and wait for approval.
- Work through `docs/PLAN.md` one step at a time; a step can start once its `Needs:` steps are ticked. Read it before starting any work.
- Don't add a dependency without approval. Propose it with its npm link, weekly downloads and maintainer; check it exists first.
- Keep diffs small. Don't fix things outside the current step; list them under **Found issues** in `docs/PLAN.md`.
- After each change, run `npm run verify`.
- If a command fails, show the error and propose a fix. Don't retry blindly.
- Never commit or push. Propose a Conventional Commit message and let the user commit after review.
- Never read `.env`, `.env.local` or any other secret file.

## Shared agent tooling

| What                      | Where                               | Claude Code                          | Codex                            |
| ------------------------- | ----------------------------------- | ------------------------------------ | -------------------------------- |
| Run the next plan step    | `.agents/skills/next-step/SKILL.md` | `/next-step [n]`                     | `$next-step`                     |
| Quality gates             | `.agents/skills/verify/SKILL.md`    | `/verify`                            | `$verify`                        |
| Diff reviewer (read-only) | `.claude/agents/reviewer.md`        | `reviewer` subagent                  | `.codex/agents/reviewer.toml`    |
| Test writer               | `.claude/agents/test-writer.md`     | `test-writer` subagent               | `.codex/agents/test-writer.toml` |
| Typecheck at end of turn  | `scripts/ai/typecheck-on-stop.sh`   | Stop hook in `.claude/settings.json` | Stop hook in `.codex/hooks.json` |
| Lint + format per edit    | `scripts/ai/lint-on-edit.sh`        | PostToolUse `Edit\|MultiEdit\|Write` | PostToolUse `apply_patch`        |

`.claude/skills/*` are symlinks to `.agents/skills/*`, so edit skills only in `.agents/skills/`.
