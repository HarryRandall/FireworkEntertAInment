/**
 * Pure helpers for the new-show wizard: file-size formatting, duration
 * formatting, storage-name sanitisation, and audio mime-type inference.
 *
 * No React imports — these are safe to share with any client component.
 */

/** Format byte counts as a short human-readable string (e.g. `2.4 MB`). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Render a duration in seconds as `M:SS`. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Strip storage-unfriendly characters from a filename, capping length. */
export function sanitizeStorageName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'audio';
}

/**
 * Suggest a show title from an audio filename: strips the extension,
 * normalises separators, and capitalises each word. Returns an empty string
 * when nothing usable remains so callers can skip the suggestion.
 */
export function suggestTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * Derive a show title from the creative brief: first handful of words,
 * capped, with the first letter capitalised. Empty string when the brief is
 * blank so callers can fall through to other sources.
 */
export function deriveTitleFromDescription(description: string): string {
  const words = description.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
  const cleaned = words
    .replace(/[.,;:!?]+$/, '')
    .slice(0, 60)
    .trim();
  if (!cleaned) return '';
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

/**
 * Browsers sometimes report an empty `File.type` for less common audio
 * containers. Fall back to mime-type-by-extension so the storage policy
 * (which checks mime) doesn't reject perfectly fine uploads.
 */
export function inferAudioContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'wav':
      return 'audio/wav';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'mp3':
    default:
      return 'audio/mpeg';
  }
}
