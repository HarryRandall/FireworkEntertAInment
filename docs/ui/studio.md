# Studio

`/admin/studio/[effectId]` opens the catalogue's active draft, falling back to its
published design. The catalogue's existing Open in Studio link reaches this route.
Opening a page does not create a draft. The loader checks the UUID, reads one effect
and one matching version under caller RLS, and validates the stored v1 document.
Missing effects return not found; missing documents and failed reads have distinct
empty and retry states.

The admin layout retains its server area guard. `AdminFrame` delegates Studio
addresses to the page's shared `WorkspaceShell` with `editorFrame`, avoiding nested
shells and main landmarks. Other admin pages keep their existing workspace chrome.
The Studio page passes the verified identity through to the editor frame. Active
catalogue editors and super admins can edit; other platform staff and archived
fireworks have a read-only editor. Server saves recheck those rights independently.

## Editing and persistence

Star groups appear beneath their containing break, with stable addresses that include
the break index and layer ID. Core flashes and rising sources are also selectable.
Collapse and preview visibility are browser state, not authored design changes.
Reset preview visibility is available in the shell's editor actions menu.

The inspector uses Radix tabs in launch order: Launch, Burst, Stars, Trail, Effect.
Fountain, tourbillon, wheel and spinner designs get one Ground panel. The selected
layer header retains its colour swatch, name, kind and section menu. Each section
renders the stored-document controls described in [Studio inspector](studio-inspector.md).
Naming and numeric gestures share the same history. No renderer values are converted
into a second editor format.

All authored changes pass through one immutable document reducer. It supports bounded
undo/redo and begin/replace/commit/cancel gestures. Undo and redo restore entire
documents; a new edit clears redo. History remains in the current browser session.
Server revalidation after the first draft save keeps the same effect editor mounted,
retaining history, selection and
the serial save controller. Opening another effect or reloading starts a new session.

The autosave controller coalesces committed edits for 600 ms and sends serial requests.
The first changed snapshot creates a draft using the existing creation RPC; subsequent
snapshots use the draft-save RPC. Published versions are never updated. Existing review
metadata is retained. Save performs an immediate retry after a failure. A response only
acknowledges its submitted snapshot: newer edits remain unsaved and are sent afterwards.
Undo during an in-flight write saves the reverted snapshot afterwards as well.

Failures retain edits and show Save failed with a retry message. Unexpected database
failures log the error code and message on the server, without logging the design.
Unload protection is active while edits are uncommitted or unsaved. Disposal cancels queued saves and UI
notifications; an already submitted request can still complete. Unsaved edits and
undo history are not persisted locally. Internal navigation does not flush pending
edits: wait for Saved before leaving. Existing RPCs provide no collaborative conflict
resolution for two editors writing the same draft. A replaced draft pointer or changed
published source is refused with a reload message.

## Stage and local checks

The stage owns one renderer Viewer. Design edits update it with the current camera
retained; unmount disposes the subscription and renderer resources. The floating
transport offers play/pause, restart and scrub. Renderer reduced-motion behaviour is
retained. WebGL startup failures are visible and do not prevent naming or saving.
The shell's editor header contains the Catalogue breadcrumb, draft/save status,
change count, centred Design/Compare/Reference switch, undo/redo, Checks popover,
Versions, Review and publish and overflow actions. Save, poster retry and preview
visibility reset remain in the overflow. Checks use one live measurement shared
with the pinned sidebar budget.

Desktop Studio fills the remaining viewport with independently scrolling side
panels and no page scroll. The prototype's left/right widths are 264/320 CSS px;
they narrow to 220/280 px for smaller desktops, retaining three columns at 1000 px.
Variations is a compact, internally scrolling thumbnail dock below the stage.
Below 900 px the stage comes first, with an internally scrolling panel sheet below
it. Its Layers and Library/Inspector navigation keeps both panel states mounted.
The side panels retain their existing tabs and internally scrolling controls.

Logic tests cover history, grouped gestures, immutable naming, repeated IDs across
breaks, preview visibility, serial acknowledgements, undo during save, failures,
retry, debounce and disposal. Browser journeys in `tests/browser/studio.spec.ts`
cover catalogue entry, layers, inspector tabs, undo/redo, Saved after reload,
failed-save retry, non-admin refusal, ground playback, light/dark, desktop/390 px,
axe and overflow. They capture full-frame and per-section screenshots under
`output/playwright/studio-*.png` for composer execution and owner review. These paths
are planned captures, not evidence that screenshots have been taken.

The layout journeys in `tests/browser/studio.spec.ts` cover 1440, 1000 and 390 CSS px
in both themes: non-overlapping stage/sidebar/inspector bounds, horizontal overflow,
desktop page-scroll containment and rendered controls in every inspector tab.
Whole viewport captures are planned at
`output/playwright/studio-layout-{1440|1000|390}-{light|dark}.png`.
The composer must run these journeys and compare the images with the prototype;
local code checks do not verify rendered appearance.
