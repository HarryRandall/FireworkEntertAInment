import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const command = process.argv[2];
const commands = {
  start: ['start'],
  stop: ['stop'],
  status: ['status'],
  reset: ['db', 'reset', '--local'],
  lint: ['db', 'lint', '--local', '--level', 'warning'],
};

function run(args, capture = false) {
  const result = spawnSync('pnpm', ['exec', 'supabase', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    // Captured status can contain credentials. Never echo its output on failure.
    throw new Error('Local Supabase command failed. Run pnpm db:status to inspect the stack.');
  }
  return result.stdout;
}

try {
  if (process.argv.length !== 3) throw new Error('Supply exactly one local database command.');
  if (command === 'env') {
    const status = JSON.parse(run(['status', '--output', 'json'], true));
    if (status.API_URL !== 'http://127.0.0.1:55421') {
      throw new Error('Expected the ShowCrafter local API at http://127.0.0.1:55421.');
    }
    if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
      throw new Error('Local Supabase did not return the required API keys.');
    }
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_URL: status.API_URL,
      SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
      SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
      PASSWORD_RECOVERY_SIGNING_SECRET: randomBytes(32).toString('hex'),
      // Explicit blanks prevent a pre-existing .env from enabling hosted services locally.
      ANALYSER_URL: '',
      ANALYSER_SHARED_SECRET: '',
      FIREWORK_IMPORT_URL: '',
      FIREWORK_IMPORT_SHARED_SECRET: '',
      FIREWORK_IMPORT_RENDER_URL: '',
      OPENROUTER_API_KEY: '',
      JAMENDO_CLIENT_ID: '',
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
    };
    writeFileSync(
      new URL('../../apps/web/.env.local', import.meta.url),
      '# Local ShowCrafter. Optional integrations are disabled until configured.\n' +
        Object.entries(env)
          .map(([key, value]) => `${key}=${value}\n`)
          .join(''),
      { flag: 'wx', mode: 0o600 },
    );
    console.log(
      'Created apps/web/.env.local with local credentials. No existing file was replaced.',
    );
  } else if (Object.hasOwn(commands, command)) {
    run(commands[command]);
  } else {
    throw new Error('Choose start, stop, status, reset, lint or env.');
  }
} catch (error) {
  console.error(
    error.code === 'EEXIST'
      ? 'apps/web/.env.local already exists; update it manually.'
      : error.message,
  );
  process.exitCode = 1;
}
