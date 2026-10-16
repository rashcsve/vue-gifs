#!/usr/bin/env bash
# Stop hook shared by Claude Code (.claude/settings.json) and Codex (.codex/hooks.json).
# Runs typecheck once per turn when .ts/.vue files have uncommitted changes.
# Exit 2 sends stderr back to the agent so it keeps working; stays silent on success
# (Codex treats plain-text stdout from a Stop hook as invalid).

input=$(cat)

# Already continuing because of this hook: let the agent stop to avoid a loop.
if [ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ]; then
  exit 0
fi

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

if [ -z "$(git status --porcelain -- '*.ts' '*.vue')" ]; then
  exit 0
fi

if ! out=$(npm run --silent typecheck 2>&1); then
  echo "Typecheck failed. Fix these errors before finishing:" >&2
  echo "$out" >&2
  exit 2
fi
