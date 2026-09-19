export const ANNOTATION_MARKER_PATTERN = /<\d+>/g;

export function createAnnotationMarker(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError(
      `Invalid annotation marker index: ${index}`,
    );
  }

  return `<${index}>`;
}

export function extractAnnotationMarkers(
  text: string,
): string[] {
  return text.match(ANNOTATION_MARKER_PATTERN) ?? [];
}

export function containsAnnotationMarker(
  text: string,
): boolean {
  return extractAnnotationMarkers(text).length > 0;
}

export interface MarkerValidationResult {
  sourceMarkers: string[];
  translatedMarkers: string[];
  missingMarkers: string[];
  duplicatedMarkers: string[];
  orderChanged: boolean;
  valid: boolean;
}

function counts(
  markers: string[],
): Map<string, number> {
  const result =
    new Map<string, number>();

  for (const marker of markers) {
    result.set(
      marker,
      (result.get(marker) ?? 0) + 1,
    );
  }

  return result;
}

export function validateAnnotationMarkers(
  source: string,
  translated: string,
): MarkerValidationResult {
  const sourceMarkers =
    extractAnnotationMarkers(source);

  const translatedMarkers =
    extractAnnotationMarkers(translated);

  const sourceCounts =
    counts(sourceMarkers);

  const translatedCounts =
    counts(translatedMarkers);

  const missingMarkers: string[] = [];
  const duplicatedMarkers: string[] = [];

  for (
    const [marker, count]
    of sourceCounts
  ) {
    const translatedCount =
      translatedCounts.get(marker) ?? 0;

    for (
      let i = translatedCount;
      i < count;
      i++
    ) {
      missingMarkers.push(marker);
    }
  }

  for (
    const [marker, count]
    of translatedCounts
  ) {
    const sourceCount =
      sourceCounts.get(marker) ?? 0;

    for (
      let i = sourceCount;
      i < count;
      i++
    ) {
      duplicatedMarkers.push(marker);
    }
  }

  const orderChanged =
    missingMarkers.length === 0 &&
    duplicatedMarkers.length === 0 &&
    sourceMarkers.some(
      (marker, index) =>
        marker !==
        translatedMarkers[index],
    );

  return {
    sourceMarkers,
    translatedMarkers,
    missingMarkers,
    duplicatedMarkers,
    orderChanged,

    valid:
      missingMarkers.length === 0 &&
      duplicatedMarkers.length === 0 &&
      !orderChanged,
  };
}