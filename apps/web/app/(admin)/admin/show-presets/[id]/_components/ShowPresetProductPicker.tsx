'use client';

import { CanvasSurface } from '@/ui/renderer/CanvasSurface';
/** Searchable dialog for inserting or replacing a cue's product. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Badge } from '@/ui/patterns/Badge';
import { Button } from '@/ui/patterns/Button';
import { Input } from '@/ui/patterns/Input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/primitives/dialog';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';
import { formatDuration } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import { ProductPickerMode, ProductKindFilter, productKindOf } from './show-preset-model';
import { LazyFireworkReplayCanvas } from './ShowPresetReplayCanvas';

export function ProductPickerDialog({
  open,
  mode,
  products,
  initialSelectedId,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  mode: ProductPickerMode;
  products: FireworkSpecification[];
  initialSelectedId?: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: FireworkSpecification) => void;
}) {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<ProductKindFilter>('all');
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? '');
  const [previewElapsed, setPreviewElapsed] = useState(0.4);
  const previewRef = useRef(0.4);
  const selectedProduct = products.find((product) => product.id === selectedId);
  const filteredProducts = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return products
      .filter((product) => kindFilter === 'all' || productKindOf(product) === kindFilter)
      .filter((product) => {
        if (!normalised) return true;
        return [product.name, product.slug, product.baseEffect?.name, product.variant?.slug]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalised);
      })
      .slice(0, 80);
  }, [kindFilter, products, query]);
  const previewCue: ReplayCue[] = selectedProduct
    ? [
        {
          id: `picker-${selectedProduct.id}`,
          position: 1,
          timeSeconds: 0.4,
          description: selectedProduct.name,
          productId: selectedProduct.id,
          launchPositionIndex: 1,
          emphasis: productKindOf(selectedProduct) === 'multishot' ? 'accent' : 'normal',
          firework: selectedProduct,
        },
      ]
    : [];

  useEffect(() => {
    if (!open) return;
    const initialProduct = products.find((product) => product.id === initialSelectedId);
    setSelectedId(initialProduct?.id ?? products[0]?.id ?? '');
    setQuery('');
    setKindFilter('all');
  }, [initialSelectedId, open, products]);

  useEffect(() => {
    if (!open || filteredProducts.some((product) => product.id === selectedId)) return;
    setSelectedId(filteredProducts[0]?.id ?? '');
  }, [filteredProducts, open, selectedId]);

  useEffect(() => {
    if (!open) return;
    const started = performance.now();
    let frame = 0;
    function tick(now: number) {
      const next = ((now - started) / 1000) % 4;
      previewRef.current = next;
      setPreviewElapsed(next);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, selectedId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] !gap-0 overflow-y-auto p-0 sm:max-w-[min(1200px,calc(100vw-2rem))] lg:overflow-hidden">
        <DialogHeader className="border-border border-b px-6 py-5">
          <DialogTitle className="text-lg">
            {mode === 'insert' ? 'Insert catalogue item' : 'Replace catalogue item'}
          </DialogTitle>
        </DialogHeader>

        <div className="border-border flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              value={query}
              iconLeft={<Search size={16} />}
              placeholder="Filter by name or effect..."
              aria-label="Search catalogue"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div
            role="group"
            aria-label="Filter catalogue type"
            className="border-border bg-muted inline-flex shrink-0 rounded-md border p-1"
          >
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'firework', label: 'Fireworks' },
                { value: 'multishot', label: 'Multishots' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={kindFilter === option.value}
                onClick={() => setKindFilter(option.value)}
                className={cn(
                  'focus-visible:ring-ring/50 h-8 rounded px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2',
                  kindFilter === option.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:h-[min(560px,calc(100dvh-14rem))] lg:min-h-0 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)]">
          <div className="border-border flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
            <div className="border-border text-muted-foreground flex items-center justify-between gap-3 border-b px-4 py-3 text-xs">
              <span>{filteredProducts.length} items</span>
              <span>Name and type</span>
            </div>
            <div
              role="listbox"
              aria-label="Catalogue items"
              className="max-h-[min(360px,45dvh)] min-h-0 flex-1 overflow-y-auto lg:max-h-none"
            >
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => {
                  const selected = product.id === selectedProduct?.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onPointerEnter={() => setSelectedId(product.id)}
                      onFocus={() => setSelectedId(product.id)}
                      onClick={() => setSelectedId(product.id)}
                      className={cn(
                        'border-border focus-visible:ring-border-emphasis grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 text-left text-sm transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
                        selected ? 'bg-muted text-foreground' : 'hover:bg-muted',
                      )}
                    >
                      <span className="min-w-0 truncate font-medium">{product.name}</span>
                      <Badge tone={productKindOf(product) === 'multishot' ? 'accent' : 'neutral'}>
                        {productKindOf(product)}
                      </Badge>
                    </button>
                  );
                })
              ) : (
                <div className="flex h-40 flex-col items-center justify-center px-6 text-center">
                  <Search size={18} className="text-muted-foreground" />
                  <p className="text-foreground mt-2 text-sm font-medium">No matching items</p>
                </div>
              )}
            </div>
          </div>

          <aside className="bg-stage-night relative min-h-[360px] overflow-hidden">
            {selectedProduct ? (
              <CanvasSurface className="absolute inset-0">
                <LazyFireworkReplayCanvas
                  cues={previewCue}
                  elapsed={previewElapsed}
                  playbackRef={previewRef}
                  muted
                  interactive
                  controlsVisible={false}
                  showCameraControls={false}
                  primeSnapshots={false}
                  showLoadingBar={false}
                />
              </CanvasSurface>
            ) : (
              <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-white/60">
                Select an item to preview it
              </div>
            )}
            <div className="pointer-events-none absolute top-4 left-4">
              <Badge tone="accent" solid>
                <Sparkles size={12} /> Effect preview
              </Badge>
            </div>
            {selectedProduct ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-5 pt-16 pb-5 text-white">
                <h3 className="line-clamp-2 text-base font-semibold">{selectedProduct.name}</h3>
                <p className="mt-1 text-xs text-white/70">
                  {productKindOf(selectedProduct)} ·{' '}
                  {formatDuration(selectedProduct.durationSeconds)}
                </p>
              </div>
            ) : null}
          </aside>
        </div>

        <DialogFooter className="border-border border-t px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedProduct}
            onClick={() => selectedProduct && onSelect(selectedProduct)}
          >
            {mode === 'insert' ? 'Insert item' : 'Use this item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
