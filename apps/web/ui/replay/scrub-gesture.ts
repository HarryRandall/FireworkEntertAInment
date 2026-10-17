/**
 * Folds a slider's change and commit callbacks into one scrub gesture whatever
 * the input device. Pointer drags report change, change, ..., commit. Keyboard
 * steps and Home/End in Radix Slider report commit first (from inside the
 * value updater) and change second, so a gesture that only ended on commit
 * would never end for the keyboard: the parent stayed in its scrubbing state
 * with the media never seeked to the new position.
 *
 * The machine holds no callbacks; each method reports whether the caller must
 * now end the gesture (call its scrub-end handler).
 */
export type ScrubGesture = {
  /** True while a gesture is in progress and the parent owns the playhead. */
  readonly active: boolean;
  /** A value change arrived; returns true when this change also completes the gesture. */
  change(): boolean;
  /** A commit arrived; returns true when a gesture was in progress and has now ended. */
  commit(): boolean;
  /** A one-shot move (tick buttons) is complete in itself; always returns true. */
  jump(): boolean;
  /** Focus left mid-drag; returns true when a gesture was in progress and has now ended. */
  leave(): boolean;
};

export function createScrubGesture(): ScrubGesture {
  let active = false;
  let commitAwaitingChange = false;
  const end = () => {
    active = false;
    commitAwaitingChange = false;
    return true;
  };
  return {
    get active() {
      return active;
    },
    change() {
      active = true;
      return commitAwaitingChange ? end() : false;
    },
    commit() {
      if (active) return end();
      // Keyboard ordering: the value that was committed arrives next.
      commitAwaitingChange = true;
      return false;
    },
    jump() {
      return end();
    },
    leave() {
      return active ? end() : false;
    },
  };
}
