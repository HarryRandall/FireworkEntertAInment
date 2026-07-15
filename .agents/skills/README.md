# Repository Skills

These skills are vendored for ShowCrafter and are available only when Codex is
working inside this repository. They are pinned so an upstream update cannot
silently change agent behaviour.

Project rules in `AGENTS.md`, the live implementation, database invariants, and
tests take precedence over generic skill advice.

| Skill | Upstream | Commit | Licence | Purpose |
| --- | --- | --- | --- | --- |
| `react-best-practices` | `vercel-labs/agent-skills` | `f8a72b9603728bb92a217a879b7e62e43ad76c81` | MIT declared in skill | React and Next.js performance reviews |
| `composition-patterns` | `vercel-labs/agent-skills` | `f8a72b9603728bb92a217a879b7e62e43ad76c81` | MIT declared in skill | Maintainable React component APIs |
| `web-design-guidelines` | `vercel-labs/agent-skills` | `f8a72b9603728bb92a217a879b7e62e43ad76c81` | Upstream repository terms | Focused accessibility and interface reviews |
| `ui-ux-pro-max` | `nextlevelbuilder/ui-ux-pro-max-skill` | `f8ac5e1266dba8354ea96e19994d9f4345e7ec31` | MIT | Searchable design and UX reference |
| `gsap-core` | `greensock/gsap-skills` | `aed9cfd3277740755f6bfc1155c7aa645403b760` | MIT | GSAP fundamentals |
| `gsap-react` | `greensock/gsap-skills` | `aed9cfd3277740755f6bfc1155c7aa645403b760` | MIT | React lifecycle and cleanup |
| `gsap-timeline` | `greensock/gsap-skills` | `aed9cfd3277740755f6bfc1155c7aa645403b760` | MIT | Sequenced motion |
| `gsap-scrolltrigger` | `greensock/gsap-skills` | `aed9cfd3277740755f6bfc1155c7aa645403b760` | MIT | Scroll-linked motion |
| `gsap-performance` | `greensock/gsap-skills` | `aed9cfd3277740755f6bfc1155c7aa645403b760` | MIT | Animation performance and accessibility |

The UI UX Pro Max instructions are adapted locally to resolve scripts through
`.agents/skills` and to make project-specific guidance authoritative. The
Vercel interface-review skill deliberately reads its latest checklist from
Vercel's public repository when invoked, so review that remote change before
accepting a surprising new rule.

The GSAP skills do not install GSAP or authorise a migration. Inspect the
existing motion path, bundle impact, reduced-motion behaviour, and browser
results before adding or replacing a dependency.

## Updating

Before updating a pin:

1. Review the upstream diff and licence.
2. Inspect executable scripts, install hooks, network access, and filesystem or
   Git operations.
3. Run dependency auditing for executable MCP servers or packages.
4. Update one upstream at a time and verify its skill triggers and helper
   scripts.
5. Record the new commit here.

Do not replace these pins with floating `main`, `latest`, or unreviewed `npx`
installers.
