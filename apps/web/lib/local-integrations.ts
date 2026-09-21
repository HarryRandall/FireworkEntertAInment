type Environment = Record<string, string | undefined>;

export type LocalIntegrationNotice = {
  feature: string;
  message: string;
};

export function usesLocalSupabase(environment: Environment): boolean {
  try {
    const url = new URL(environment.NEXT_PUBLIC_SUPABASE_URL || environment.SUPABASE_URL || '');
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Configuration diagnostics only. A configured service still needs an end-to-end check. */
export function getLocalIntegrationNotices(environment: Environment): LocalIntegrationNotice[] {
  if (!usesLocalSupabase(environment)) return [];
  const notices: LocalIntegrationNotice[] = [];
  const missing = (keys: string[]) => keys.filter((key) => !environment[key]?.trim());

  const analyser = missing(['ANALYSER_URL', 'ANALYSER_SHARED_SECRET']);
  notices.push({
    feature: 'Music analysis',
    message: analyser.length
      ? `Not configured. Set ${analyser.join(' and ')} to enable music analysis.`
      : 'Credentials are configured, but the hosted analyser cannot fetch audio from localhost. Use an isolated hosted development database or an explicitly configured HTTPS Storage endpoint reachable by the analyser.',
  });

  if (missing(['JAMENDO_CLIENT_ID']).length) {
    notices.push({
      feature: 'Music search',
      message: 'Set JAMENDO_CLIENT_ID to enable Jamendo search.',
    });
  }
  if (missing(['OPENROUTER_API_KEY']).length) {
    notices.push({
      feature: 'AI services',
      message:
        'Set OPENROUTER_API_KEY to enable model-based show generation and video reconstruction. Local fast and beat planning do not need this key.',
    });
  }

  if (!environment.FIREWORK_IMPORT_URL?.trim()) {
    notices.push({
      feature: 'Video imports',
      message:
        'Hosted dispatch is disabled. To use local imports, configure the worker credentials and FIREWORK_IMPORT_RENDER_URL, then run pnpm worker:firework-import. The worker must be running to process uploads.',
    });
  } else {
    const keys = missing(['FIREWORK_IMPORT_SHARED_SECRET']);
    notices.push({
      feature: 'Video imports',
      message: keys.length
        ? 'Set FIREWORK_IMPORT_SHARED_SECRET before using hosted dispatch.'
        : 'Hosted dispatch is configured. Its worker needs a reachable development database and render URL; localhost on the worker is not this computer.',
    });
  }
  return notices;
}
