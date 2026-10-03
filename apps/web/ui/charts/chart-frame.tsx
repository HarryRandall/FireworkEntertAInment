/** Chart cards expose the same measurements through a keyboard-accessible data table. */
import type { ReactNode } from 'react';
import { CHART_HEIGHT_PX } from './chart-theme';
/** Presents an SVG visual alongside exact labelled measurements, without relying on hover. */
export function ChartFrame({
  title,
  description,
  rows,
  children,
  legend,
}: {
  title: string;
  description: string;
  rows: readonly { label: string; value: string | number }[];
  children: ReactNode;
  legend?: ReactNode;
}) {
  return (
    <figure className="border-border bg-card grid min-w-0 grid-cols-1 gap-3 rounded-xl border p-4">
      <figcaption>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-muted-foreground text-xs">{description}</p>
      </figcaption>
      <div
        role="region"
        aria-label={`${title} chart`}
        tabIndex={0}
        className="min-w-0 overflow-x-auto"
      >
        <div aria-hidden="true" style={{ height: CHART_HEIGHT_PX }}>
          {children}
        </div>
      </div>
      {legend}
      <details className="text-sm">
        <summary className="cursor-pointer">View {title.toLowerCase()} data</summary>
        <div
          role="region"
          aria-label={`${title} measurements`}
          tabIndex={0}
          className="max-h-64 overflow-auto"
        >
          <table className="w-full text-left">
            <caption className="sr-only">{title} measurements</caption>
            <thead>
              <tr>
                <th scope="col">Measurement</th>
                <th scope="col" className="text-right">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="py-1 font-normal">
                    {row.label}
                  </th>
                  <td className="text-right tabular-nums">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
/** Shows colour keys with text so chart categories never rely on colour alone. */
export function ChartLegend({
  labels,
  colours,
}: {
  labels: readonly string[];
  colours: readonly string[];
}) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-3 text-xs" aria-label="Chart legend">
      {labels.map((label, index) => (
        <li key={label} className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="size-2 rounded-sm"
            style={{ background: colours[index % colours.length] }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
