@AGENTS.md

## Claude Code specifics

- Permissions live in `.claude/settings.json`: quality-gate commands are allowed; `git commit`, package installs and `npx` ask; `git push` is denied. Bash runs in a sandbox that blocks `.env*` reads and allows network only to the npm registry.
- A Stop hook runs `npm run typecheck` once per turn when `.ts`/`.vue` files have changed, and sends the errors back to you. Don't treat mid-edit type errors as failures; finish the change first.
- A PostToolUse hook runs `eslint --fix` (ts/vue/js files) then Prettier on every file you Edit/Write, and sends back ESLint errors and warnings it can't fix, plus Prettier parse errors. Re-read a file before editing it again if the hook may have reformatted it.
