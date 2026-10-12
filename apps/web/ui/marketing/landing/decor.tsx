/** Show palette dots drawn over the landing sky's controls. */

/* ---------- Palette dots ---------- */
export function PaletteDots({ palette }: { palette: string[] }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="Show palette">
      {palette.map((c, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.18)_inset]"
          style={{ backgroundColor: c }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
