---
name: next-step
description: Pick up the next unchecked step from docs/PLAN.md (or a given step number), plan it, implement it after approval, verify, and get it reviewed. Use when the user says "next step", "continue the plan", or names a step number.
---

# Next plan step

Shared by Claude Code (`/next-step [n]`) and Codex (`$next-step`). Requested step, if any: $ARGUMENTS

1. Read `docs/PLAN.md`. Take the requested step, or the first unchecked one whose `Needs:` steps are all ticked.
2. Read the files that step touches. Reply with:
   - the step number and goal
   - files to change
   - out of scope
   - a 3–6 bullet approach
   - new packages, if any: name, npm link, weekly downloads, maintainer
   - how it will be verified, including what to click in the running app

   **Stop and wait for approval.**

3. If the step changes logic: spawn the `test-writer` subagent in test-first mode. Give it the plan step text and the agreed public interface (names and signatures), not your implementation approach. Confirm the tests fail for the right reason and show them to the user. Until step 4 is done, red tests and typecheck errors from missing exports are expected; don't fix them by editing the tests. **Wait for approval of the tests.**
4. Implement in small edits that follow the conventions in `AGENTS.md`. Don't create or edit `*.spec.ts` files. If a test looks wrong, stop and ask. If you find behaviour that has no test, spawn `test-writer` again for it.
5. Run the `verify` skill. Fix failures that are inside this step. Anything else: show the error and propose a fix. If the same failure survives two fix attempts, stop and report what you tried.
6. Get the diff reviewed:
   - Spawn the `reviewer` subagent.
   - Then run the built-in reviewer for correctness bugs: `/code-review` in Claude Code, `/review` in Codex.
   - Address findings, or explain why one doesn't apply.
   - Suggest the user also run the other tool's reviewer on the diff (cross-model review).
7. Ask the user to check it in the running app (`npm run dev`), with the exact steps to click.
8. Tick the step's checkbox in `docs/PLAN.md` and add any out-of-scope issues under **Found issues**.
9. Propose a Conventional Commit message. Don't commit.
