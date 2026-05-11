function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}

export function getNormalizedImportPreview(metadata) {
  const metadataRecord = asRecord(metadata);
  if (!metadataRecord) return null;
  const preview = asRecord(metadataRecord.normalizedPreview);
  if (!preview) return null;

  const storagePath =
    typeof preview.storagePath === "string" && preview.storagePath.trim().length > 0
      ? preview.storagePath
      : null;
  if (!storagePath) return null;

  const mimeType =
    typeof preview.mimeType === "string" && preview.mimeType.trim().length > 0
      ? preview.mimeType
      : "video/mp4";

  return { storagePath, mimeType };
}

export function getPreferredImportVideoSource(mediaAsset) {
  const normalizedPreview = getNormalizedImportPreview(mediaAsset?.metadata);
  if (normalizedPreview) return normalizedPreview;
  return {
    storagePath:
      typeof mediaAsset?.storagePath === "string" ? mediaAsset.storagePath : null,
    mimeType: typeof mediaAsset?.mimeType === "string" ? mediaAsset.mimeType : null,
  };
}
