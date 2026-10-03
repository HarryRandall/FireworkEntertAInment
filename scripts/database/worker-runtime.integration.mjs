// Pass fixed local service credentials to the Python acceptance process without printing them.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { repositoryRoot, storageCredentials } from './runtime.mjs';

const { url, key } = storageCredentials({ local: true });
const python = join(repositoryRoot, 'services/worker-common/.venv/bin/python');
const result = spawnSync(
  python,
  [join(repositoryRoot, 'services/worker-common/tests/local_integration.py')],
  {
    cwd: repositoryRoot,
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
