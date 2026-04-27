import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  DB_TEST_TABLES,
  type DbTestTableKey,
  isDbTestTableKey,
} from "@/lib/supabase-db-tables";

export const metadata: Metadata = {
  title: "DB test — ShowCrafter",
  description: "Read-only view of Supabase public tables (dev / QA).",
};

const ROW_LIMIT = 100;

function rowKey(row: Record<string, unknown>, hint: string): string {
  const v = row[hint];
  if (v !== null && v !== undefined && String(v) !== "") return String(v);
  return JSON.stringify(row).slice(0, 80);
}

export default async function DbTestPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const sp = await searchParams;
  const tableKey: DbTestTableKey = isDbTestTableKey(sp.table)
    ? sp.table
    : "wiki";

  const config = DB_TEST_TABLES[tableKey];
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from(config.id)
    .select("*")
    .limit(ROW_LIMIT);

  const rows =
    data && Array.isArray(data)
      ? (data as Record<string, unknown>[])
      : null;

  const columns =
    rows && rows.length > 0
      ? Object.keys(rows[0]!)
      : [];

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant/20 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Supabase database test
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Table{" "}
            <code className="text-tertiary font-mono text-xs">{config.id}</code>{" "}
            · up to {ROW_LIMIT} rows
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-primary hover:underline font-medium"
        >
          ← Home
        </Link>
      </header>

      <nav className="px-6 py-3 border-b border-outline-variant/10 flex flex-wrap gap-2">
        {(Object.keys(DB_TEST_TABLES) as DbTestTableKey[]).map((key) => {
          const t = DB_TEST_TABLES[key];
          const active = key === tableKey;
          return (
            <Link
              key={key}
              href={`/db-test?table=${key}`}
              className={
                active
                  ? "px-3 py-1.5 rounded-full text-sm bg-primary/20 text-primary font-medium"
                  : "px-3 py-1.5 rounded-full text-sm text-on-surface-variant hover:bg-surface-container-high/50"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <main className="p-6 max-w-[100vw]">
        {error ? (
          <div
            className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm space-y-2 max-w-2xl"
            role="alert"
          >
            <p className="font-medium text-error">Could not load rows</p>
            <p className="text-on-surface-variant">{error.message}</p>
            <p className="text-on-surface-variant text-xs leading-relaxed">
              If you see a permission or RLS error, add a{" "}
              <code className="font-mono">SELECT</code> policy for the anon /
              authenticated role on this table in Supabase, or use the service
              role only from trusted server routes (not this page).
            </p>
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="max-w-2xl space-y-2 text-sm text-on-surface-variant">
            <p>No rows returned.</p>
            <p className="text-xs leading-relaxed">
              If the table has data in the Supabase dashboard but nothing shows
              here, <strong className="text-on-surface">RLS</strong> is usually
              hiding rows from the anonymous key. Add{" "}
              <code className="font-mono text-tertiary">SELECT</code> policies
              for <code className="font-mono text-tertiary">anon</code> (and
              optionally <code className="font-mono text-tertiary">authenticated</code>)
              on this table, or confirm the table is actually empty.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-outline-variant/15 overflow-hidden bg-surface-container-low/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-outline-variant/20 bg-surface-container/40">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 font-medium text-on-surface-variant whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={`${rowKey(row, config.primaryHint)}-${i}`}
                      className="border-b border-outline-variant/10 hover:bg-surface-container-high/20"
                    >
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2 text-on-surface align-top max-w-[280px]"
                        >
                          <span className="line-clamp-3 break-words">
                            {formatCell(row[col])}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-on-surface-variant px-3 py-2 border-t border-outline-variant/10">
              Showing {rows.length} row{rows.length === 1 ? "" : "s"}
              {rows.length >= ROW_LIMIT ? ` (capped at ${ROW_LIMIT})` : ""}.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
