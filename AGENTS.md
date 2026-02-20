# AGENTS.md — Codex / Agent Operating Guide (north-star)

This repository is a large monorepo. Some agent runs can generate many untracked build artifacts
(e.g. `.next/`, `dist/`, `.turbo/`, `node_modules/`) which may cause `git status` to hang or time out.
These rules exist to ensure tasks reliably complete and can be pushed to GitHub.

---

## 0) Non-negotiable rules

### ✅ MUST
- Always operate from the repo root (verify with `git rev-parse --show-toplevel`).
- Create a new branch for each task.
- Stage changes in a way that does NOT enumerate untracked files.
- Finish by committing and pushing the branch to remote.

### ❌ MUST NOT
- **Do NOT run `git status`** (including `git status --short`). It can hang in this repo.
- Do NOT run any command that enumerates the full untracked set (e.g. `git add -A`, `git add .`).
- Do NOT modify git remotes, authentication, or tokens.
- Do NOT run destructive cleanups (`git clean`, deleting lockfiles, removing `.git/`) unless the user explicitly asks.

---

## 1) Preflight checks (fast, safe)

Run these at the start of a task:

```bash\
git remote add origin https://github.com/cmyeung25/north-star.git
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
git remote -v || true