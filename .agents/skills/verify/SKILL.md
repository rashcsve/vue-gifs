---
name: verify
description: Run the project's quality gates (typecheck, lint, tests, build) and report a pass/fail summary. Use after any code change or before proposing a commit.
---

# Verify

Shared by Claude Code (`/verify`) and Codex (`$verify`).

Run `npm run verify`. It is the same gate husky runs on `pre-push` (and CI will, from plan step 7): typecheck, lint, format check, unit tests and build, stopping at the first failure.

If it fails, run the checks it didn't reach one at a time so the full picture is visible:

1. `npm run typecheck`
2. `npm run lint:check`
3. `npm run format:check`
4. `npm test`
5. `npm run build`

Report a short table with each check and ✅/❌. For each ❌, give the first relevant error lines and a proposed fix. This skill only reports; the caller (you, or the `next-step` skill) decides what to fix.
