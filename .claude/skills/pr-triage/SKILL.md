---
name: pr-triage
description: >
  Review a pull request with ponytail-review, sort every finding into tier 1
  (critical bug), tier 2 (minor bug) or tier 3 (unreachable), fix what the
  tier rules allow, file the rest as GitHub issues, and post one summary
  comment. Use for "triage this PR", "review PR #N before merge", /pr-triage.
---

Finding problems is easy; a reviewer that looks will always find some.
Sorting them is the job. Fix what matters, park the rest, never pad the list.

Adapted for BJJ Log from the author's own skill of the same name.

## 1. Review

Run the `ponytail-review` skill on the pull request named in the prompt (or
the current branch against `dev` when none is named). Read `AGENTS.md`
first: its safety rules and engineering invariants are part of the review.
A change that breaks an invariant listed there is a bug.

Keep ponytail's evidence bar: every finding needs a concrete input or
situation that leads to a wrong result. No case, no finding.

## 2. Tier every finding

Judge reachability against how BJJ Log actually runs today (`ARCHITECTURE.md`,
`README.md`): one person, a private journal, deployed only from `prod`. Not
against hypothetical future callers.

- **Tier 1, critical bug.** Reachable now, and it causes a wrong result, a
  crash, data loss, a security or privacy hole, a leaked secret, or breaks an
  `AGENTS.md` invariant.
- **Tier 2, minor bug.** Reachable now, but the impact is small or
  recoverable: a confusing error, a cosmetic UI fault, risky new logic with no
  test that would catch it breaking.
- **Tier 3, unreachable.** Needs an input, state or load that cannot happen
  today, or it is not a bug at all (lean, speed, structure suggestions).

When unsure between two tiers, pick the lower one and say why in one line.

## 3. Act on the tier

- **Tier 1: always fix.**
- **Tier 2: fix only if** the fix is trivial (a few lines, one file, no new
  dependency, no migration) **or** the case is a likely edge case (empty
  input, last item, retry, time zone, a second source). Otherwise file it.
- **Tier 3: never fix.** File it.

Fix rules:

- Smallest fix that works; prefer fixes that delete code.
- Never touch `db/migrations/`, `vercel.json`, `neon.ts`, `scripts/`,
  `.github/`, `.claude/`, `.env*` files, or secrets. A tier 1 that needs one
  of those is reported as **needs human** instead of fixed.
- Never run `tests/storage.spec.ts`, `npm run test:e2e`, or anything that
  reaches a database or a server. There is no database here.
- After fixing, run `npm run typecheck` and `npm run lint`. If either fails,
  undo the fix that broke it and file that finding instead.
- Put all fixes in one commit on the PR branch, message
  `review: fix tier 1/2 findings from pr-triage`, body listing finding
  numbers. Then push to the PR branch. Do not open a new branch or PR, and
  never push to `dev` or `prod`.

Filing rules:

- One GitHub issue per filed finding, labelled `tier-2` or `tier-3` (create
  the label if missing). Title: the finding's bold title. Body: the four
  ponytail parts (what this is, problem, fix, if we skip it), the file and
  line, and `Found in #<PR number>`.
- Before creating, search open issues for the same file and problem; if one
  exists, comment the PR link on it instead of opening a duplicate.

This repository is public. Never put secrets, environment values, deployment
URLs, personal paths or journal text in a commit, issue or comment.

## 4. Report

Post exactly one PR comment:

```
## pr-triage

What this change does: <two or three sentences>

| # | Tier | Finding | Action |
|---|------|---------|--------|
| 1 | T1 | <title> (`path:line`) | fixed in <short sha> |
| 2 | T2 | <title> | filed #<issue> |
| 3 | T3 | <title> | filed #<issue> |

Verdict: <Ship. | Ship after you review the fix commit. | Needs human: <why>.>
Checked: typecheck and lint <passed | failed: why> on the fix commit.
Not checked: <one line, only if something mattered and could not be checked>
```

Nothing found: the "What this change does" line, then `Looks good. Ship.`
and one line on what was checked.
