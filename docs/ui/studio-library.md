# Studio Library and variations

Studio uses the existing editor frame, Viewer, document reducer and draft autosave.
Library hover and keyboard focus previews are independent copies: they never save or
change the main stage. Whole fireworks open a replacement confirmation; all authored
changes, including applying a variation, use the same undo history.

## Library copies

Fireworks and star groups come from the renderer's canonical templates. Trail looks
reuse the inspector presets. Effects add a modifier without removing existing ones;
a saved Effects item copies the saved modifier combination. Launch tails retain the
current climb, height, smoke and lean. Star groups add to the selected break, with new
IDs, reset relative delay and visible stars. Trails and Effects require a selected
star group. Invalid or full targets stay disabled or show a refusal.

Saved parts are shared by active catalogue editors and super admins. The save form
can copy a star group, its trail, its modifier combination or the launch tail. Parts
are immutable `studio_library_parts` rows with caller attribution and a validated
v1 renderer envelope. The single-layer envelope keeps preview context without linking
the part to effect/version history. Applying a part copies its values; subsequent
source edits do not change fireworks already using it. This does not add library
removal or whole-firework saving, which belong to catalogue management.

The thin public save function delegates to a private security-definer function with
an empty search path and the existing catalogue-editor fence. Client table writes
are not granted. RLS hides saved parts from shoppers, retailers, suppliers,
reviewers and suspended staff. Server actions independently validate input and
recheck staff authority. Database read failures remain failures, rather than an
empty Library. Unexpected save failures remain visible and retain the name form.

## Preview and variation behaviour

Previews use the renderer's shared `poster()` context. A hover card is anchored to
its chip, with an arrow and viewport collision handling. Captures are serial within
a clip, so a slow frame cannot queue an unbounded animation backlog. Removing the
card cancels its next frame and ignores stale completion. Reduced motion uses a
still. Launch-tail cards frame the climb; other cards frame the burst.

Six variation slots match the prototype. Rolls use deterministic seeded variation
of resolved star counts, radii and trail density within schema bounds, plus a new
renderer seed. Timing, colours and modifier combinations stay intact. Ground effects
vary by renderer seed. Locks keep their exact snapshot when the current design
changes or another roll is requested. Locks and candidates stay in the browser;
only applying one changes and autosaves the current draft.

Undo uses Command+Z or Ctrl+Z. Redo uses Command+Shift+Z, Ctrl+Shift+Z or Ctrl+Y.
Inputs, textareas, selects, contenteditable fields, composing text and already
handled keys retain their native editing behaviour. Toolbar hints advertise the
bindings. A draft save does not clear history or convert published history into
editable rows.

## Composer acceptance

Run the local database suite and `pnpm check` with the seeded local stack. Browser
coverage is in `tests/browser/studio-library.spec.ts` and `studio.spec.ts`:

- Admin Library apply and confirmation/cancellation, save and persisted reload.
- Chip hover/focus previews, locks and reroll, apply undo/redo keyboard commands.
- Layers, inspector sections, autosave and the Saved pill after reload.
- Retailer refusal, native text editing and reduced motion.
- Desktop and 390 px, light and dark, axe, overflow and section screenshots.

Screenshots are written under `output/playwright/library-<size>-<theme>-*.png` and
attached by the journeys. Capture `prototype/studio.html` and its corresponding
Library/hover interaction from `prototype/editor.html` alongside them for owner
review. The sandbox did not run a browser or a dev server; screenshot files do not
exist until the composer runs the journeys. Typechecking these tests is not proof
that their interactions or visuals pass.
