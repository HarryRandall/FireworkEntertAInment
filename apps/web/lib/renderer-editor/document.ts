/** Immutable document history is the single path for authored editor changes. */
import type { Design } from '@showcrafter/renderer';

const HISTORY_LIMIT = 100; // Browser snapshots, matching the proven editor's undo budget.
/** Document snapshots and an optional gesture origin, all in stored renderer units. */
export interface EditorHistory<Document = Design> {
  document: Document;
  undo: Document[];
  redo: Document[];
  gesture: Document | null;
}
/** A gesture groups transient document replacements into one undo step. */
export type EditorEdit<Document = Design> =
  | { type: 'replace'; document: Document }
  | { type: 'begin' | 'commit' | 'cancel' | 'undo' | 'redo' };
/** Starts browser history without mutating the supplied validated document. */
export function createHistory<Document>(document: Document): EditorHistory<Document> {
  return { document, undo: [], redo: [], gesture: null };
}
function sameDocument<Document>(left: Document, right: Document): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
function commitDocument<Document>(
  state: EditorHistory<Document>,
  document: Document,
  before = state.document,
) {
  if (sameDocument(before, document)) return { ...state, document, gesture: null };
  return {
    document,
    undo: [...state.undo, before].slice(-HISTORY_LIMIT),
    redo: [],
    gesture: null,
  };
}
/** Applies immutable edits; begin/replace/commit makes a drag one undo step, cancel restores it. */
export function editorReducer<Document>(
  state: EditorHistory<Document>,
  edit: EditorEdit<Document>,
): EditorHistory<Document> {
  switch (edit.type) {
    case 'begin':
      return state.gesture !== null ? state : { ...state, gesture: state.document };
    case 'replace':
      return state.gesture !== null
        ? { ...state, document: edit.document }
        : commitDocument(state, edit.document);
    case 'commit':
      return state.gesture !== null ? commitDocument(state, state.document, state.gesture) : state;
    case 'cancel':
      return state.gesture !== null ? { ...state, document: state.gesture, gesture: null } : state;
    case 'undo':
    case 'redo':
      return stepHistory(state, edit.type);
  }
}
function stepHistory<Document>(
  state: EditorHistory<Document>,
  direction: 'undo' | 'redo',
): EditorHistory<Document> {
  if (state.gesture !== null) return state;
  const source = state[direction];
  const document = source.at(-1);
  if (document === undefined) return state;
  const target = direction === 'undo' ? 'redo' : 'undo';
  return {
    ...state,
    document,
    [direction]: source.slice(0, -1),
    [target]: [...state[target], state.document].slice(-HISTORY_LIMIT),
  };
}
