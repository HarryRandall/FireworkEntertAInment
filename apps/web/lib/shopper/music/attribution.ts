/** Source-work links complement creator credit and the Creative Commons licence. */
/** Builds the Jamendo source-work link for a provider track identity, encoding the path segment. */
export function jamendoTrackUrl(providerTrackId: string): string {
  return `https://www.jamendo.com/track/${encodeURIComponent(providerTrackId)}`;
}
