# Workspace shell

`ui/shell/workspace-shell.tsx` owns the rail, sidebar, breadcrumb and shared utility
panels for `/retailer`, `/admin`, `/supplier` and `/account`. Each route layout is a
thin server composition boundary. Navigation is configured in one file per area
under `ui/shell/config/`; every destination has an honest placeholder page.

The retailer and admin sections follow the prototype's `workspace.css` and
workspace pages. The 60 px rail, 228 px sidebar and 980/640 px responsive breakpoints
come from that prototype. At phone width, the rail becomes a bottom bar and the
header's Navigation button provides section pages, context switchers and utilities.
Tabs use the kit's local Radix panels and never change areas.

Server-rendered shell controls remain inert until hydration installs their client
handlers. Browser journeys wait for that boundary after full page loads, so fast
clicks cannot silently precede the tab and navigation handlers.

## Inputs and access policy

`WorkspaceShell` accepts an area key, children, optional organisation/store choices
and notifications. The context selectors use local preview state. They do not
claim to load data, change tenancy on the server or persist a selection.

`visibility.area(area)` and `visibility.item(item, area)` are optional presentation
predicates applied to the area switcher, rail, sidebar, shortcuts and command menu.
They are not access boundaries. Area keys match the auth contract's `Area` values:
`retailer`, `admin`, `supplier`, `account`, with corresponding root hrefs.
The auth integration can pass a predicate closing over `canAccessArea(area, identity)`
inside a client composition boundary; server layouts enforce actual route access.
Do not pass server functions across the React server/client boundary.

Command search is restricted to the current area's visible destinations. Cmd+K or
Ctrl+K opens it; ? opens the shortcuts panel. Text fields and existing dialogs keep
their own keyboard input. Radix traps panel focus and Escape dismisses it. Inbox
read state is local; profile actions explicitly describe the demo identity and offer
light, dark and system theme preferences.

## Editor frame and review

The optional `editorFrame` input supplies a title, Save callback, pending state and
menu actions. It removes the section sidebar, retains the area rail and breadcrumb,
and allocates the remaining height to editor-owned content. It adds no back arrow
and implements no editing, saving or version history itself.

`/dev/shell` provides synthetic contexts, every area, restricted visibility and an
editor with library, stage and inspector placeholders. Save only reports a local
preview action. `/dev` links to this review page.

`tests/browser/shell.spec.ts` covers every configured destination, shortcuts, local
tabs, area and context switchers, command keys and selection, notification read
state, profile theme, visibility predicates, desktop/390 px layout, light/dark,
axe and per-section screenshot captures. Browser execution and screenshots require
the composer. No screenshot baseline is approved by the implementation alone.

## Registry source

The used command primitives adapt the MIT shadcn `command` registry item retrieved
from `https://ui.shadcn.com/r/styles/new-york-v4/command.json`. The exact registry and
raw source are in `docs/vendor/ui/shadcn/command`; the manifest records the content
hash and adapted target. `cmdk` is pinned to 1.1.1. Existing kit Radix menus, tabs,
inbox and shortcuts are reused. The shell composition and retailer context state
are domain-specific; they are not additional copies of generic registry controls.
