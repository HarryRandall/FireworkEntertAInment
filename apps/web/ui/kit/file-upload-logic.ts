/** Shared file acceptance checks for browse and drop paths. */
/** Returns a visible validation error or null for an accepted file; maximum size is bytes. */
export function fileError(
  file: { name: string; type: string; size: number },
  accept: string,
  maxBytes: number,
): string | null {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new RangeError('Maximum file size must be positive bytes');
  }
  if (file.size > maxBytes) {
    return 'The file exceeds the size limit.';
  }
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter((rule) => rule.length > 0);
  const matches =
    rules.length === 0 ||
    rules.some((rule) => {
      if (rule.startsWith('.')) {
        return file.name.toLowerCase().endsWith(rule);
      }
      if (rule.endsWith('/*')) {
        return file.type.toLowerCase().startsWith(rule.slice(0, -1));
      }
      return file.type.toLowerCase() === rule;
    });
  return matches ? null : 'Choose a supported file type.';
}
