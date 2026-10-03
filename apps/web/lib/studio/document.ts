/** Immutable document history is the single path for authored Studio changes. */
import type { Design } from '@showcrafter/fireworks';

const HISTORY_LIMIT = 100; // Browser snapshots, matching the proven editor's undo budget.
/** Document snapshots and an optional gesture origin, all in stored renderer units. */
export interface StudioHistory {
  document: Design;
  undo: Design[];
  redo: Design[];
  gesture: Design | null;
}
/** A gesture groups transient document replacements into one undo step. */
export type StudioEdit =
  | { type: 'replace'; document: Design }
  | { type: 'begin' | 'commit' | 'cancel' | 'undo' | 'redo' };
/** Starts browser history without mutating the supplied validated design. */
export function createHistory(document: Design): StudioHistory {
  return { document, undo: [], redo: [], gesture: null };
}
function sameDocument(left: Design, right: Design): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
function commitDocument(state: StudioHistory, document: Design, before = state.document) {
  if (sameDocument(before, document)) return { ...state, document, gesture: null };
  return {
    document,
    undo: [...state.undo, before].slice(-HISTORY_LIMIT),
    redo: [],
    gesture: null,
  };
}
/** Applies immutable edits; begin/replace/commit makes a drag one undo step, cancel restores it. */
export function studioReducer(state: StudioHistory, edit: StudioEdit): StudioHistory {
  switch (edit.type) {
    case 'begin':
      return state.gesture ? state : { ...state, gesture: state.document };
    case 'replace':
      return state.gesture
        ? { ...state, document: edit.document }
        : commitDocument(state, edit.document);
    case 'commit':
      return state.gesture ? commitDocument(state, state.document, state.gesture) : state;
    case 'cancel':
      return state.gesture ? { ...state, document: state.gesture, gesture: null } : state;
    case 'undo':
    case 'redo':
      return stepHistory(state, edit.type);
  }
}
function stepHistory(state: StudioHistory, direction: 'undo' | 'redo'): StudioHistory {
  if (state.gesture) return state;
  const source = state[direction];
  const document = source.at(-1);
  if (!document) return state;
  const target = direction === 'undo' ? 'redo' : 'undo';
  return {
    ...state,
    document,
    [direction]: source.slice(0, -1),
    [target]: [...state[target], state.document].slice(-HISTORY_LIMIT),
  };
}
/** Renames a stable layer at a zero-based break index without mutating the source or sibling layers. */
export function renameLayer(
  document: Design,
  breakIndex: number,
  layerId: string,
  name: string,
): Design {
  return {
    ...document,
    breaks: document.breaks.map((burst, index) =>
      index === breakIndex
        ? {
            ...burst,
            layers: burst.layers.map((layer) =>
              layer.id === layerId ? { ...layer, name } : layer,
            ),
          }
        : burst,
    ),
  };
}
