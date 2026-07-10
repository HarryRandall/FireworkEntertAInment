# Editor Integrity

These rules apply to the firework, effect, style-default, and multishot editors,
plus shared preview controls.

## Save Behaviour

Capture a stable signature of the editor state when a save begins. When the
request returns, build the saved snapshot from the canonical row returned by
the database, not the raw client input. Replace visible local fields only if
the current signature still matches the captured signature. This preserves
edits made while the request was in flight without displaying trimmed or
coerced input as a falsely clean saved value.

Keep the latest-signature ref current in a layout effect. A passive effect can
run after a fast save response and briefly expose the previous render's
signature, while mutating a ref during render violates the React ref contract.

For overlapping requests, ignore stale responses or otherwise ensure the latest
requested state wins. Flush or deliberately cancel pending debounced work before
navigation, deletion, or unmount. If an optimistic delete fails, restore the
item and surface a recoverable error.

The primary record save is authoritative. Record version history after that
save as best-effort work. A missing history table or failed history insert must
not turn a successful editor save into a failure. Expose history actions only
when they perform the stated operation.

If a deterministic optimistic history row is shown while deferred recording
finishes, keep Restore disabled until the ID is observed in the database. Use a
short bounded confirmation loop with unmount and target-change cancellation.
After the final failed attempt, remove the optimistic row and show a
history-only warning that the primary editor change is still saved.

## Preview Cache Keys

Invalidate preview caches for every value that can change simulation output.
The key includes cue identity and timing, product and firework identity, launch
position index and coordinates, seed, emphasis, pan, tilt, position override,
calibre, duration, and the effective render design or raw specification.

Do not key only on cue IDs or array length. Memoise stable cue arrays where
timer-driven renders would otherwise restart playback.

## Ranges And Validation

Keep shared physical ranges in one implementation source. Align control bounds,
schema validation, server actions, defaults, and renderer handling.

- Clamp speed, life, duration, and size values to valid non-negative ranges.
- Build midpoint ranges without producing a negative lower bound.
- Preserve ordering for two-value ranges.
- Reject or normalise non-finite values at the boundary.
- Keep multishot pan, tilt, delay, and position bounds consistent across UI and
  server validation.

Do not use a wider slider range than the action accepts, or silently persist a
value the renderer cannot represent.

## Accessibility And Interaction

- Put an accessible name on the actual slider thumb or interactive primitive.
- Put the visible label's target ID on the focusable thumb, not the Radix root,
  so clicking the label moves focus to the control.
- Associate visible labels, hints, errors, values, and units with the control.
- Preserve keyboard operation and visible focus states.
- Use `aria-live` for save and error feedback when the status changes without a
  focus move.
- Keep icon-only controls named and provide a text alternative for colour-only
  state.
- Do not label a button Preview, Restore, Delete, or Save unless it performs
  that action.

## Focused Verification

Run the editor correctness tests, TypeScript, and file-scoped lint while
iterating. Verify at least one save with a second edit made before the first
request resolves, one preview-changing edit for each cache input family, range
endpoints, keyboard slider operation, and history failure fallback.
