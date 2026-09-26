if (process.argv.includes('--apply') || process.argv.includes('--backup'))
  throw new Error(
    'This command is read-only. Use backfill-emission.mjs for a reviewed conversion.',
  );
await import('./backfill-emission.mjs');
