/** Labelled flat maps explain every stored design change in review and history. */
import type { Design } from '@showcrafter/fireworks';

/** One changed stored value, including additions, removals and array order. */
export interface DesignChange {
  key: string;
  label: string;
  from: string;
  to: string;
}
interface FlatValue {
  label: string;
  value: string;
}
interface NamedLayer {
  id: string;
  name: string;
}
const words = (key: string) => key.replaceAll('_', ' ').replaceAll('.', ' › ');
function isNamedLayer(value: unknown): value is NamedLayer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string'
  );
}
function flattenArray(
  value: unknown[],
  key: string,
  label: string,
  output: Map<string, FlatValue>,
) {
  if (key.endsWith('.layers')) {
    const layers = value.filter(isNamedLayer);
    // Stable identities separate a reorder from authored layer changes.
    output.set(`${key}.order`, {
      label: `${label} › Order`,
      value: JSON.stringify(layers.map((layer) => layer.id)),
    });
    for (const layer of layers)
      flatten(layer, `${key}.${layer.id}`, `${label} › ${layer.name} (${layer.id})`, output);
  } else if (key === 'breaks') {
    output.set('breaks.length', { label: 'Breaks › Count', value: String(value.length) });
    value.forEach((item, index) => {
      flatten(item, `breaks.${String(index)}`, `Break ${String(index + 1)}`, output);
    });
  } else output.set(key, { label, value: JSON.stringify(value) });
}
function flatten(value: unknown, key: string, label: string, output: Map<string, FlatValue>) {
  if (Array.isArray(value)) {
    flattenArray(value, key, label, output);
    return;
  }
  if (value !== null && typeof value === 'object') {
    const fields = Object.entries(value);
    // Empty objects are stored values too, including adjustment-map additions and removals.
    if (fields.length === 0) output.set(key, { label, value: '{}' });
    for (const [field, child] of fields)
      flatten(
        child,
        key === '' ? field : `${key}.${field}`,
        label === '' ? words(field) : `${label} › ${words(field)}`,
        output,
      );
    return;
  }
  output.set(key, { label, value: value === null ? 'None' : JSON.stringify(value) });
}
function changeAt(
  key: string,
  previous: Map<string, FlatValue>,
  current: Map<string, FlatValue>,
): DesignChange[] {
  const before = previous.get(key);
  const after = current.get(key);
  if (before?.value === after?.value) return [];
  const removed = before ?? { label: key, value: 'None' };
  const added = after ?? { label: removed.label, value: 'None' };
  return [{ key, label: added.label, from: removed.value, to: added.value }];
}
/** Compares validated v1 documents without mutation or rounding away small authored changes. */
export function designChanges(before: Design | null, after: Design): DesignChange[] {
  const previous = new Map<string, FlatValue>();
  const current = new Map<string, FlatValue>();
  if (before !== null) flatten(before, '', '', previous);
  flatten(after, '', '', current);
  return [...new Set([...previous.keys(), ...current.keys()])].flatMap((key) =>
    changeAt(key, previous, current),
  );
}
