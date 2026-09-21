import { loadEnvFile } from 'node:process';
import { join } from 'node:path';
import { databaseTarget, query, repositoryRoot } from './runtime.mjs';

try {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const target = databaseTarget(['--project-ref', ref ?? '']);
  loadEnvFile(join(repositoryRoot, '.vercel/.env.production.local'));
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co`) {
    throw new Error('The Vercel production database URL does not match the migration destination.');
  }
  const receipt = query(target, 'select media_ready from private.installation where id = true;')[0];
  if (!receipt?.media_ready)
    throw new Error('Finish the fresh hosted installation before enabling automatic deployment.');
  console.log('Production application and migration destination match an installed baseline.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
