---
name: verify
description: Run the project's quality gates (typecheck, lint, tests, build) and report a pass/fail summary. Use after any code change or before proposing a commit.
---
# Verify

Shared by Claude Code (`/verify`) and Codex (`$verify`).

Run these in order and keep going after a failure so the full picture is visible:

1. `npm run typecheck`
2. `npm run lint:check` (known broken until PLAN step 5a; report it but don't block on it)
3. `npm test`, if a `test` script exists in `package.json`
4. `npm run build`

Report a short table with each check and ✅/❌. For each ❌, give the first relevant error lines and a proposed fix. This skill only reports; the caller (you, or the `next-step` skill) decides what to fix.
