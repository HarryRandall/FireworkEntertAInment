/** Current product and selection-pack dependencies determine catalogue and show impact. */
/** Finds current composed products and enclosing packs affected by an effect or product. */
export function dependentProductIds(
  data: {
    products: { id: string; current_version_id: string | null }[];
    bindings: { product_version_id: string; effect_id: string }[];
    packs: { item_id: string; pack_id: string }[];
  },
  kind: 'effect' | 'product',
  id: string,
): Set<string> {
  const ids = new Set(
    kind === 'product'
      ? [id]
      : data.products
          .filter((product) =>
            data.bindings.some(
              (binding) =>
                binding.product_version_id === product.current_version_id &&
                binding.effect_id === id,
            ),
          )
          .map((product) => product.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of data.packs) {
      if (ids.has(item.item_id) && !ids.has(item.pack_id)) {
        ids.add(item.pack_id);
        changed = true;
      }
    }
  }
  return ids;
}
