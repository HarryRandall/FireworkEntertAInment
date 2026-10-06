/** Last-clicked Space routing and click-versus-drag playback, with scoped cleanup. */
interface PlaybackTarget {
  toggle(): void;
}
// Prototype tap thresholds, in CSS pixels and wall-clock milliseconds.
const CLICK_DISTANCE_PX = 4;
const CLICK_TIME_MS = 300;
const viewers = new Set<PlaybackTarget>();
let active: PlaybackTarget | null = null;
function keydown(event: KeyboardEvent): void {
  if (event.code !== 'Space' || event.repeat || event.metaKey || event.ctrlKey || event.altKey)
    return;
  const element = document.activeElement;
  if (element?.closest('input, textarea, select, button, [contenteditable], [role="slider"]'))
    return;
  const viewer = active ?? viewers.values().next().value;
  if (!viewer) return;
  event.preventDefault();
  viewer.toggle();
}
/** Registers pointer playback and Space routing; a moved, cancelled or multi-touch gesture is not a click. */
export function viewerInput(
  viewer: PlaybackTarget,
  host: HTMLElement,
  canvas: HTMLElement,
  clickToPause: boolean,
): () => void {
  if (viewers.size === 0) document.addEventListener('keydown', keydown);
  viewers.add(viewer);
  const abort = new AbortController();
  const signal = abort.signal;
  wireCanvas(viewer, host, canvas, { clickToPause, signal });
  return () => {
    abort.abort();
    viewers.delete(viewer);
    if (active === viewer) active = null;
    if (viewers.size === 0) document.removeEventListener('keydown', keydown);
  };
}

function wireCanvas(
  viewer: PlaybackTarget,
  host: HTMLElement,
  canvas: HTMLElement,
  options: { clickToPause: boolean; signal: AbortSignal },
): void {
  const { signal, clickToPause } = options;
  const pointers = new Set<number>();
  let down: { id: number; x: number; y: number; time: number } | null = null;
  host.addEventListener(
    'pointerdown',
    () => {
      active = viewer;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      pointers.add(event.pointerId);
      canvas.focus({ preventScroll: true });
      down =
        pointers.size === 1 && event.button === 0 && !event.shiftKey
          ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() }
          : null;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= CLICK_DISTANCE_PX)
        down = null;
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerup',
    (event) => {
      pointers.delete(event.pointerId);
      if (
        down?.id === event.pointerId &&
        performance.now() - down.time < CLICK_TIME_MS &&
        clickToPause
      )
        viewer.toggle();
      down = null;
    },
    { signal },
  );
  for (const name of ['pointercancel', 'lostpointercapture'] as const)
    canvas.addEventListener(
      name,
      (event) => {
        pointers.delete(event.pointerId);
        down = null;
      },
      { signal },
    );
}

/** Clips an owned canvas independently of backing-buffer density and restores host styles on cleanup. */
export function clipCanvasSurface(container: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const previous = {
    position: container.style.position,
    overflow: container.style.overflow,
    borderRadius: container.style.borderRadius,
    isolation: container.style.isolation,
  };
  const computed = getComputedStyle(container);
  const inheritedRadius = computed.borderRadius === '0px' ? 'inherit' : computed.borderRadius;
  const owned = {
    position: computed.position === 'static' ? 'relative' : previous.position,
    overflow: 'hidden',
    borderRadius: previous.borderRadius !== '' ? previous.borderRadius : inheritedRadius,
    isolation: 'isolate',
  };
  Object.assign(container.style, owned);
  // Absolute percentage sizing uses the untransformed padding box, excluding borders.
  // Physical DPR dimensions must never participate in CSS layout or intrinsic sizing.
  canvas.style.cssText =
    'position:absolute;inset:0;display:block;width:100%;height:100%;max-width:100%;max-height:100%;box-sizing:border-box;';
  return () => {
    for (const key of Object.keys(previous) as (keyof typeof previous)[])
      if (container.style[key] === owned[key]) container.style[key] = previous[key];
  };
}

/** Mounts a focusable gesture canvas inside its clipped host. */
export function mountViewerSurface(container: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const cleanup = clipCanvasSurface(container, canvas);
  canvas.style.touchAction = 'none';
  canvas.setAttribute('aria-label', 'Firework preview');
  canvas.tabIndex = 0;
  container.append(canvas);
  return cleanup;
}
