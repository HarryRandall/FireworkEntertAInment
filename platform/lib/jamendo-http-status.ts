export function isRetryableJamendoStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
