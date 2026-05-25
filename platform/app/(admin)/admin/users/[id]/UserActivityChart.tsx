'use client';

/** Activity chart visualising the user's recent events on the admin user detail page. */

import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, Tooltip, XAxis, YAxis } from 'recharts';

type Datum = { date: string; count: number };

export function UserActivityChart({ data }: { data: Datum[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const total = data.reduce((sum, d) => sum + d.count, 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (total === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-[color:var(--color-border-subtle)] text-sm text-[color:var(--color-content-subtle)]">
        No show activity in the last 30 days.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-44 w-full min-w-0">
      {size.width > 0 && size.height > 0 ? (
        <AreaChart
          data={data}
          width={size.width}
          height={size.height}
          margin={{ top: 6, right: 6, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="userShowsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-content-emphasis)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-content-emphasis)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => value.slice(5)}
            stroke="var(--color-content-muted)"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke="var(--color-content-muted)"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={20}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-default)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-content-subtle)' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--color-content-emphasis)"
            strokeWidth={1.5}
            fill="url(#userShowsFill)"
          />
        </AreaChart>
      ) : null}
    </div>
  );
}
