/** Public tables we surface on the DB test page (names must match Supabase / PostgREST). */
export const DB_TEST_TABLES = {
  wiki: {
    id: "Wikifireworks sample database",
    label: "Wiki fireworks sample",
    primaryHint: "PART NUMBER",
  },
  finale: {
    id: "Finale3D CSV Import Sample",
    label: "Finale3D CSV import",
    primaryHint: "partNumber",
  },
} as const;

export type DbTestTableKey = keyof typeof DB_TEST_TABLES;

export function isDbTestTableKey(s: string | undefined): s is DbTestTableKey {
  return s !== undefined && s in DB_TEST_TABLES;
}
