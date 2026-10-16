#!/usr/bin/env bash
# PostToolUse hook shared by Claude Code (.claude/settings.json, Edit|MultiEdit|Write) and
# Codex (.codex/hooks.json, apply_patch). Runs ESLint --fix and Prettier on the files the
# agent just edited. Exit 2 sends remaining ESLint problems (errors or warnings) and
# Prettier parse errors back to the agent on stderr; stays silent on success
# (Codex ignores plain-text stdout).

if ! command -v jq >/dev/null; then
  echo "lint-on-edit: jq not found, skipping per-edit lint" >&2
  exit 1
fi

input=$(cat)

root=${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}
[ -n "$root" ] && cd "$root" || exit 0
root=$(pwd -P)

prettier="$root/node_modules/.bin/prettier"
eslint="$root/node_modules/.bin/eslint"
[ -x "$prettier" ] && [ -x "$eslint" ] || exit 0

cwd=$(jq -r '.cwd // empty' <<<"$input")
[ -n "$cwd" ] || cwd=$root

# Claude Code: tool_input.file_path. Codex apply_patch: patch text in tool_input.command
# (also accept a bare string or .input, in case a Codex version sends the patch that way).
paths=$(jq -r '
  .tool_input as $t
  | if ($t | type) == "object" and $t.file_path then $t.file_path
    else (if ($t | type) == "string" then $t else ($t.command // $t.input // "") end
          | if type == "string" then . else join("\n") end
          | split("\n")[] | sub("\r$"; "")
          | capture("^\\*\\*\\* (Add File|Update File|Move to): (?<p>.+)$") | .p)
    end' <<<"$input")

files=()
lint_files=()
while IFS= read -r p; do
  [ -n "$p" ] || continue
  case "$p" in /*) ;; *) p="$cwd/$p" ;; esac
  # Skip symlinked files: their target may be outside the repo, and pwd -P below
  # only resolves the directory.
  [ -f "$p" ] && [ ! -L "$p" ] || continue
  # Resolve ".." and directory symlinks so the inside-repo check can't be bypassed.
  p="$(cd "$(dirname "$p")" && pwd -P)/$(basename "$p")"
  case "$p" in "$root"/*) ;; *) continue ;; esac
  rel=${p#"$root"/}
  files+=("$rel")
  case "$rel" in *.ts | *.tsx | *.vue | *.js | *.cjs | *.mjs) lint_files+=("$rel") ;; esac
done <<<"$paths"

[ ${#files[@]} -gt 0 ] || exit 0

eslint_args=(--no-warn-ignored --max-warnings=0)

# Same order and flags as lint-staged: ESLint --fix, then Prettier.
eslint_failed=0
if [ ${#lint_files[@]} -gt 0 ]; then
  "$eslint" --fix "${eslint_args[@]}" -- "${lint_files[@]}" >/dev/null 2>&1 || eslint_failed=1
fi

prettier_out=$("$prettier" --write --ignore-unknown --log-level=warn -- "${files[@]}" 2>&1 >/dev/null)
prettier_status=$?

# Report after Prettier so line numbers match the file the agent will re-read.
if [ "$eslint_failed" -ne 0 ]; then
  eslint_out=$("$eslint" "${eslint_args[@]}" -- "${lint_files[@]}" 2>&1)
fi

if [ "$eslint_failed" -ne 0 ] || [ "$prettier_status" -ne 0 ]; then
  if [ "$eslint_failed" -ne 0 ]; then
    echo "ESLint problems in files you just edited (fix errors and warnings):" >&2
    echo "$eslint_out" >&2
  fi
  if [ "$prettier_status" -ne 0 ]; then
    echo "Prettier could not format files you just edited:" >&2
    echo "$prettier_out" >&2
  fi
  exit 2
fi
