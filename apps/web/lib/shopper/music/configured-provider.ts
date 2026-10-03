/** Server-only credential binding retains one bounded search cache per process. */
import 'server-only';
import { jamendoProvider, type MusicProvider } from './provider';
let configured: { key: string; provider: MusicProvider } | undefined;
/** Returns no provider when search is unconfigured; credentials never enter a response. */
export function configuredMusicProvider(): MusicProvider | null {
  const key = process.env.JAMENDO_CLIENT_ID?.trim();
  if (key === undefined || key === '') return null;
  if (configured?.key !== key) configured = { key, provider: jamendoProvider(key) };
  return configured.provider;
}
