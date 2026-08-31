/** Only replace local editor state when it still matches the state that began the save. */
export function canApplySavedEditorSnapshot(
  saveStartedFromSignature: string,
  currentSignature: string,
): boolean {
  return saveStartedFromSignature === currentSignature;
}
