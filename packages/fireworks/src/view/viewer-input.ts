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

/** Mounts a focusable gesture canvas and returns cleanup for the host's owned positioning style. */
export function mountViewerSurface(container: HTMLElement, canvas: HTMLCanvasElement): () => void {
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  canvas.setAttribute('aria-label', 'Firework preview');
  canvas.tabIndex = 0;
  const position = container.style.position;
  const needsPosition = getComputedStyle(container).position === 'static';
  if (needsPosition) container.style.position = 'relative';
  container.append(canvas);
  return () => {
    if (needsPosition && container.style.position === 'relative')
      container.style.position = position;
  };
}
