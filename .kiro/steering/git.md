---
inclusion: always
---

# Git rules (this repository only)

- Author and committer: `Janghoon Lee <44862514+savagemanage@users.noreply.github.com>`.
  Set them per command, never in git config:
  `GIT_AUTHOR_NAME="Janghoon Lee" GIT_AUTHOR_EMAIL=44862514+savagemanage@users.noreply.github.com GIT_COMMITTER_NAME="Janghoon Lee" GIT_COMMITTER_EMAIL=44862514+savagemanage@users.noreply.github.com git commit -F <msgfile>`
- Every commit message ends with the trailer `Co-authored-by: Kiro <noreply@kiro.dev>`.
- Conventional commit subjects (`feat:`, `fix:`, `docs:`, `chore:`).
- Before every push run `scripts/guard-push.sh`. If it fails, do not push; fix the commit.
  Never put real emails, AWS account ids, keys, tokens or `.env` files in the repo.
  Use `example.com` emails and `111122223333` style account ids in docs and seed data.
- Branches: `develop` is the default; lanes use `feat/<lane>`; `main` only through a release PR.
- Push with an explicit branch name: `git push origin feat/<lane>`.
- Commit and push after each coherent step, never batch a day of work.

# Brand

- Logo: option A "Pulse" (`design/mockups/logos.html`): a flat line that beats once.
  Mark on a rounded square, fg color in Light, blood red `#b3121c` in Haunted.
