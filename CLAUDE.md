@AGENTS.md

## Claude Code specifics

- Permissions live in `.claude/settings.json`: quality-gate commands are allowed; `git commit`, package installs and `npx` ask; `git push` is denied. Bash runs in a sandbox that blocks `.env*` reads and allows network only to the npm registry.
- A Stop hook runs `npm run typecheck` once per turn when `.ts`/`.vue` files have changed, and sends the errors back to you. Don't treat mid-edit type errors as failures; finish the change first.
