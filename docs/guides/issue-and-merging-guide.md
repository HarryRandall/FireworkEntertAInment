---
notion-url: https://www.notion.so/Issue-Merging-Guide-Please-Read-325cd8a5bf0880f3aafcfcc7c4fcbc37
title: Issue & Merging Guide
date: '2026-03-16 04:14:00.000'
from_notion: https://www.notion.so/Issue-Merging-Guide-325cd8a5bf0880f3aafcfcc7c4fcbc37
author: From Notion
last_edited_time: '2026-03-30 05:10:00.000'
---
# Issue, Merging & Review Guide

> No work begins without an issue. No exception.

---

## 1. Creating an Issue

### Issue Requirements

 | Field | Details | 
 | ---- | ---- | 
 | **Title** | Clear, concise summary of the work | 
 | **Priority** | `🔴 Critical` / `🟠 High` / `🟡 Medium` / `🟢 Low` | 
 | **Assignee** | The person responsible for delivering the work | 
 | **Project** | The Project this issue belongs to | 
 | **Project Milestone** | The milestone this issue contributes to | 
 | **Time Estimate** | Expected effort (e.g. S, M, XL) | 
 | **Status** | Start at `Backlog` → `In Progress` → `Done` | 

### Required Labels

- `Bug`

- `Feature`

- `Documentation`

- `Sprint #` — e.g. `Sprint 4`

- `Epic` — only add this label if the issue belongs to an epic

---

### Issue Templates

### Technical Issues → Use the GitHub Issue Template

> Navigate to **Issues → New Issue** and select the appropriate template.

### Non-Technical Issues → Freeform

---

## 2. Branches & Commits

### Branch Naming


```plain text
<type>/#<GitHubIssueNumber>-<short-description>
```


```plain text
feature/#42-user-authentication
fix/#87-broken-login-button
refactor/#101-quote-service-cleanup
docs/#55-update-readme
```

### Commit Message Format


```plain text
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

- Separate the header, body, and footer with a **blank line**

- The description is **mandatory** — the body and footer are optional

### Types

 | Type | When to use | 
 | ---- | ---- | 
 | `feat` | Add, adjust, or remove a feature in the API or UI | 
 | `fix` | Fix a bug in the API or UI | 
 | `refactor` | Rewrite or restructure code without changing behaviour | 
 | `perf` | A `refactor` that specifically improves performance | 
 | `style` | Code style changes only (whitespace, formatting, semicolons) — no logic change | 
 | `test` | Add or correct tests | 
 | `docs` | Documentation changes only | 
 | `build` | Build tools, dependencies, project version | 
 | `ops` | Infrastructure, CI/CD, deployment, monitoring, backups | 
 | `chore` | Miscellaneous tasks — initial commit, `.gitignore` changes, etc. | 

### Description Rules

- Use the **imperative, present tense**: `add`, not `added` or `adds`

	- Think: *"This commit will..."* or *"This commit should..."*

- **Do not** capitalise the first letter

- **Do not** end with a period (`.`)

### Breaking Changes


```plain text
feat(api)!: remove status endpoint
```


```plain text
BREAKING CHANGE: the status endpoint has been removed entirely
```

### Footer


```plain text
Closes #42
Fixes #87
BREAKING CHANGE: ticket endpoints no longer support listing all entities
```

---

### Commit Examples


```plain text
feat: add email notifications on new direct messages
```


```plain text
fix/#87-broken-button: prevent submitting an empty form
```


```plain text
refactor(quote-service): simplify approval flow logic
```


```plain text
fix: add missing parameter to service call

The error occurred because the timeout value was not being passed
through to the underlying HTTP client.

Closes #91
```


```plain text
feat(api)!: remove deprecated v1 endpoints

BREAKING CHANGE: all v1 endpoints have been removed. Migrate to v2.
```


```plain text
docs: update README with setup instructions
```


```plain text
chore: init
```

---

## 3. Working an Issue

### Status Progression


```plain text
Backlog  →  In Progress  →  In Review  →  Done
```

- Move to **In Progress** when you begin work

- Move to **In Review** when a Pull Request is opened and ready for review

---

## 4. Pull Requests & Code Review

### Opening a Pull Request

- Open a PR from your issue branch targeting `main`

- Link the issue in the PR description (e.g. `Closes #42`)

- Assign at least one reviewer before requesting review

### Code Review Rules

- All review feedback must be left as **comments on GitHub** — no verbal-only reviews

- Reviewers should comment on specific lines where possible

- The author must respond to or resolve all comments before merging

- Approval from at least one reviewer is required to merge

### Merging

- Merge only after all comments are resolved and approval is given

- Use **Squash and Merge** unless otherwise agreed for the project

- After merging, confirm the issue is moved to **Done**

---

## 5. Post-Merge Cleanup

### Close the Branch


```bash
# Delete remote branch (also available via GitHub UI after merge)
git push origin --delete feature/#42-user-authentication

# Delete local branch
git branch -d feature/#42-user-authentication
```

### Close the Issue

- Close the issue on GitHub once the PR is merged

- If you used `Closes #<issue>` in the PR description, GitHub will close it automatically on merge

---

## Quick Reference Checklist

### Before Starting Work

- [ ] Issue exists with title, priority, assignee, project, milestone, time estimate

- [ ] Issue has a Type label (`Bug` / `Feature` / `Documentation`)

- [ ] Issue has a Sprint label (`Sprint #`)

- [ ] Epic label added if applicable

- [ ] Technical issues use the GitHub Issue Template

- [ ] Issue status set to **In Progress**

- [ ] Branch created following `<type>/#IssueNumber-short-description` format

### During Review

- [ ] PR linked to the issue (`Closes #XX`)

- [ ] At least one reviewer assigned

- [ ] Issue status set to **In Review**

- [ ] All review feedback left as GitHub comments

- [ ] All comments resolved before merging

- [ ] Commits follow the Conventional Commits format

### After Merge

- [ ] Issue status set to **Done**

- [ ] Issue closed on GitHub

- [ ] Branch deleted (remote + local)

---

## Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)

- [Conventional Commits Cheatsheet](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13)

