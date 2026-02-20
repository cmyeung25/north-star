# Git workflow rules
- Do NOT run `git status` (can hang in this repo).
- Do NOT run commands that enumerate untracked files.
- Use `git diff --name-only` for checks.
- For committing:
  - create branch `codex/<YYYYMMDD>-<slug>`
  - `git add -u`
  - `git add <explicit new file paths>` only when necessary
  - `git commit -m "..."`
  - `git push -u origin <branch>`