/** Polls an external playhead only while its stage is visible and its transport is running. */
export function visibleClock(
  host: HTMLElement,
  running: () => boolean,
  sample: () => void,
): { wake: () => void; dispose: () => void } {
  let visible = false;
  let frame = 0;
  let disposed = false;
  const cancel = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const wake = () => {
    cancel();
    if (disposed || !visible || document.hidden) return;
    sample();
    if (running()) frame = requestAnimationFrame(wake);
  };
  const observer = new IntersectionObserver((entries) => {
    visible = entries.at(-1)?.isIntersecting ?? false;
    wake();
  });
  observer.observe(host);
  document.addEventListener('visibilitychange', wake);
  return {
    wake,
    dispose: () => {
      disposed = true;
      cancel();
      observer.disconnect();
      document.removeEventListener('visibilitychange', wake);
    },
  };
}
