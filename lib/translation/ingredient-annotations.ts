import type {AnnotationPosition, IngredientAnnotation, Instruction} from "../cookidoo/types";
import {createAnnotationMarker, validateAnnotationMarkers} from "./markers";

export class IngredientAnnotationPlacementError extends Error {
  constructor() {
    super("No safe position for INGREDIENT annotation");
    this.name = "IngredientAnnotationPlacementError";
  }
}

export function overlaps(a: AnnotationPosition, b: AnnotationPosition): boolean {
  return a.offset < b.offset + b.length && b.offset < a.offset + a.length;
}

function validRange(position: AnnotationPosition, text: string, type: string): void {
  const {offset, length} = position;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
      offset < 0 || length <= 0 || offset + length > text.length) {
    throw new RangeError(`Invalid ${type} annotation range: offset ${offset}, length ${length}`);
  }
}

export interface CapturedIngredient {
  annotation: IngredientAnnotation;
  visibleText: string;
}

export function captureIngredients(instruction: Instruction): CapturedIngredient[] {
  const occupied = instruction.annotations.filter((a) =>
    a.type === "TTS" || a.type === "MODE" || a.type === "INGREDIENT")
    .map((a) => ({type: a.type, position: a.position!}));
  for (const item of occupied) validRange(item.position, instruction.text, item.type);
  for (let i = 0; i < occupied.length; i++) {
    for (let j = i + 1; j < occupied.length; j++) {
      if (overlaps(occupied[i]!.position, occupied[j]!.position)) {
        throw new RangeError(`Overlapping ${occupied[i]!.type} and ${occupied[j]!.type} annotation ranges`);
      }
    }
  }
  return instruction.annotations.filter((a): a is IngredientAnnotation => a.type === "INGREDIENT")
    .map((annotation) => ({
      annotation: structuredClone(annotation),
      visibleText: instruction.text.slice(annotation.position.offset, annotation.position.offset + annotation.position.length),
    }));
}

async function translateDescription(
  annotation: IngredientAnnotation,
  translate: (text: string) => Promise<string>,
): Promise<void> {
  const description = annotation.data.description;
  if (description === undefined) return;
  if (typeof description === "string") {
    annotation.data.description = await translate(description);
    return;
  }
  const volumes = [...description.annotations].sort((a, b) => a.position.offset - b.position.offset);
  for (let i = 0; i < volumes.length; i++) {
    validRange(volumes[i]!.position, description.text, "VOLUME");
    if (i && overlaps(volumes[i - 1]!.position, volumes[i]!.position)) {
      throw new RangeError("Overlapping VOLUME annotation ranges");
    }
  }
  if (!volumes.length) {
    description.text = await translate(description.text);
    return;
  }
  const markers = volumes.map((_, i) => createAnnotationMarker(i));
  let protectedText = description.text;
  const spans = volumes.map((volume) => description.text.slice(volume.position.offset,
    volume.position.offset + volume.position.length));
  for (let i = volumes.length - 1; i >= 0; i--) {
    const {offset, length} = volumes[i]!.position;
    protectedText = protectedText.slice(0, offset) + markers[i] + protectedText.slice(offset + length);
  }
  const translated = await translate(protectedText);
  const markerValidation = validateAnnotationMarkers(protectedText, translated);
  if (markerValidation.missingMarkers.length || markerValidation.duplicatedMarkers.length) {
    throw new Error("Translation changed protected VOLUME markers");
  }
  const translatedSpans = await Promise.all(spans.map(translate));
  if (translatedSpans.some((span) => !span.length)) throw new Error("Translated VOLUME display is empty");
  let restored = translated;
  for (const [index, marker] of markers.map((marker, index) => [index, marker] as const)
    .sort((a, b) => restored.indexOf(a[1]) - restored.indexOf(b[1]))) {
    const offset = restored.indexOf(marker);
    const span = translatedSpans[index]!;
    restored = restored.slice(0, offset) + span + restored.slice(offset + marker.length);
    volumes[index]!.position = {offset, length: span.length};
  }
  description.text = restored;
  description.annotations = volumes.sort((a, b) => a.position.offset - b.position.offset);
}

export async function restoreIngredients(
  instruction: Instruction,
  captured: CapturedIngredient[],
  translate: (text: string) => Promise<string>,
): Promise<Instruction> {
  const occupied = instruction.annotations.filter((a) => a.type === "TTS" || a.type === "MODE")
    .map((a) => a.position!);
  const items = await Promise.all(captured.map(async ({annotation, visibleText}) => {
    const clone = structuredClone(annotation);
    await translateDescription(clone, translate);
    return {annotation: clone, candidate: await translate(visibleText)};
  }));
  const placed = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    const candidate = items[i]!.candidate;
    if (!candidate) continue;
    const offset = instruction.text.indexOf(candidate);
    if (offset < 0 || instruction.text.indexOf(candidate, offset + candidate.length) >= 0) continue;
    const position = {offset, length: candidate.length};
    if (occupied.some((other) => overlaps(position, other))) continue;
    items[i]!.annotation.position = position;
    occupied.push(position);
    placed.add(i);
  }
  for (let i = 0; i < items.length; i++) {
    if (placed.has(i)) continue;
    const find = (whitespaceOnly: boolean): AnnotationPosition | undefined => {
      for (let offset = 0; offset < instruction.text.length; offset++) {
        if (whitespaceOnly && !/\s/.test(instruction.text[offset]!)) continue;
        const position = {offset, length: 1};
        if (!occupied.some((other) => overlaps(position, other))) return position;
      }
    };
    const position = find(true) ?? find(false);
    if (!position) throw new IngredientAnnotationPlacementError();
    items[i]!.annotation.position = position;
    occupied.push(position);
  }
  return {...instruction, annotations: [...instruction.annotations, ...items.map((item) => item.annotation)]
    .sort((a, b) => a.position!.offset - b.position!.offset)};
}
