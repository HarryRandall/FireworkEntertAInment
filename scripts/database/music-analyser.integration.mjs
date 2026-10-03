// Pass fixed local service credentials to the Python acceptance process without printing them.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { repositoryRoot, storageCredentials, supabase } from './runtime.mjs';

const { url, key } = storageCredentials({ local: true });
const status = JSON.parse(supabase(['status', '--output', 'json']));
if (!status.ANON_KEY) throw new Error('Local anonymous API key required');
const python = join(repositoryRoot, 'services/music-analyser/.venv/bin/python');
const result = spawnSync(
  python,
  [join(repositoryRoot, 'services/music-analyser/tests/local_integration.py')],
  {
    cwd: repositoryRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: key,
      SHOWCRAFTER_LOCAL_ANON_KEY: status.ANON_KEY,
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
