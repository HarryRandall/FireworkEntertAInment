# Component kit

`/dev/components` is the owner's review page. It groups live examples as Forms,
Choices, Feedback, Navigation, Workspace, Shopper, Editor and Motion, with a sidebar
on desktop and wrapping anchor links on phones. The theme selector supports light,
dark and system through the existing `.dark` class provider. Viewer stills retain
cinematic stage colours in both themes.

## Ownership and sources

Shared components live in `apps/web/ui/kit/`; the gallery's synthetic data and state
live in its route's `_components` folder. Registry sources are fetched only for
components this page uses. `docs/vendor/ui/manifest.json` records every source URL,
its content hash, retrieval date, upstream repository revision, MIT licence, raw
files and adapted working targets. Each provider's licence is retained in the same
folder. Raw `.txt` files and registry responses are immutable evidence, excluded
only from automatic formatting and never compiled into the application.

The adaptations keep shadcn's Radix semantics for choices, sliders, switches,
menus, tabs and dialogs. Text controls retain native browser semantics. ReUI's
upload flow is adapted into a controlled single-file selector with shared browse
and drop validation; it does not own transport or image object URLs. ReUI's stepper
is adapted to a controlled, zero-based reached/current model with native buttons.
The narrower APIs avoid unnecessary local state, persistence and Base UI dependencies.

ShowCrafter-specific compositions are bespoke: product posters, planned shows,
printable labels, layer rows, curve/gradient graphs, notification data, split
settings and compact Nivo sparklines. These need domain props or renderer
maths that the fetched primitives do not supply. Tag parsing is a small controlled
composition of input and badge patterns; it keeps invalid emails visible and
preserves existing multi-word tags. No Origin UI or AGPL code is used.

Magic UI's shimmer button, border beam, marquee, gradient text, blur fade and number
ticker are adapted to tokens and CSS/browser frames without a motion-library
dependency. CSS motion stops under reduced motion; the ticker subscribes to the
system preference, cancels its frames and shows its final value immediately.
The marquee also has a persistent pause/resume button. Loading and typing indicators
keep their status text with reduced motion.

## Studio props

### ProductPicker

Supply `label`, `items`, `selected` ids and `onChange(ids)`. Each item has a stable
`id`, `name`, `metadata`, formatted `price`, optional `poster` URL,
`posterError` message and `disabled` flag. This keeps catalogue queries, currency
formatting and poster lifecycle in the caller. The gallery captures real built-in
3D designs with the shared `poster()` context, progressively publishes blob URLs,
ignores cancelled captures, revokes its URLs and disposes the surface after capture.
A missing URL means loading, while a supplied error means failure.

### CurveEditor

Supply `label`, a renderer `Brightness` value and `onChange(value)`. Keys must be
finite, ordered and distinct, with at least two keys, within normalised life
`[0, 1]`. Values are brightness units, not percentages. `maxValue` is a positive
finite axis maximum, defaulting to 1; Studio can supply 10 for the stored brightness
range. `pinEnds` defaults to true and fixes endpoint times, while leaving their
values editable. `disabled` stops all changes. No input is mutated.

Pointer dragging and editable time/value rows share `moveCurveKey`. Clicking the
graph adds a key at the pointer position. The Add key button inserts into the
widest remaining gap, using `brightnessAt` interpolation. Removal buttons are
keyboard accessible and retain at least two keys. Moving keys never crosses their
neighbours. The preview samples the renderer's piecewise-linear curve, rather than
drawing a visually smooth curve with different simulation behaviour.

### GradientEditor

Supply `label`, the full renderer `Colour` value and `onChange(value)`. Stops must
be finite, ordered and distinct, with at least two stops. `maxTime` is the displayed
normalised life extent, defaulting to 1; use 2 for extended stored colour fades.
`pinEnds` defaults to true, and `disabled` stops all changes. The mode, palette
arrays and reignition settings survive edits. Each palette colour gets its own
editable input. No input is mutated.

Drag handles or edit time rows to move stops. Click the bar to add one, or use the
Add stop button for a keyboard-accessible insertion in the widest gap. New colours
sample `colourAt` for each palette lane. Preview colours sample the renderer's
linear RGB and invert its display gamma to sRGB; the bar represents the first star
of a palette. Stops remain ordered, endpoints may be pinned, and removal retains
the required two stops. Both editors enforce the schema's 32-stop capacity.

## Review and checks

Logic tests cover tag delimiters and email feedback, bounded/scientific decimal
steps, file acceptance, pointer bounds, key ordering and endpoint pinning, renderer
interpolation, palette preservation, insertion/removal and schema capacity.
Registry tests compare hashes and every raw source byte and check adapted targets
and required notices exist. The web test command uses the workspace's TypeScript
loader, so tests execute the actual TypeScript implementations.

`tests/browser/components.spec.ts` covers desktop/390 px light/dark screenshots,
reduced motion, overflow, accessibility, keyboard choices, tags, uploads, dialog
focus and editor rows/dragging. It is part of the existing browser suite and must
be run by the composer. Capture paths are
`output/playwright/components-{desktop,phone}-{light,dark}.png`.
Compare them with the read-only prototype's `components.html` and obtain owner
review. Local lint/typechecks and a successful build do not establish pixel parity
or browser interaction correctness.

The stat-card sparkline uses pinned `@nivo/line` 0.99.0, with animation disabled and
semantic stroke colours. Tables, full charts, dashboard filters and the workspace shell are outside this
kit change. Print labels take caller-supplied QR artwork; the gallery labels use
an explicitly labelled illustration. Chat demonstrations are local presentation,
with no AI service, network submission or persistence.
