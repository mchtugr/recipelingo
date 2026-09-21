import type {Instruction, ProtectedCookingAnnotation} from "../cookidoo/types";
import type {AnnotationFormatter} from "./annotation-formatters";
import {containsAnnotationMarker} from "./markers";
import type {TranslatedPreparedInstruction} from "./translate-prepared-instruction";

/** Only protected TTS/MODE annotations are rebuilt; unprotected source offsets are discarded. */
export function restoreInstruction(
    translated: TranslatedPreparedInstruction,
    formatter: AnnotationFormatter,
): Instruction {
    let text = translated.text;
    const annotations: ProtectedCookingAnnotation[] = [];
    const displays: string[] = [];

    const protectedAnnotations =
        translated.protectedAnnotations
            .map((item) => {
                const firstOffset =
                    translated.text.indexOf(
                        item.marker,
                    );

                if (
                    firstOffset < 0 ||
                    translated.text.indexOf(
                        item.marker,
                        firstOffset +
                        item.marker.length,
                    ) >= 0
                ) {
                    throw new Error(
                        `Expected exactly one annotation marker: ${item.marker}`,
                    );
                }

                return {
                    item,
                    offset: firstOffset,
                };
            })
            .sort(
                (a, b) =>
                    a.offset - b.offset,
            );


    for (const {item} of protectedAnnotations) {
        const {
            marker,
            annotation,
            originalText,
            glyphs,
        } = item;

        const offset = text.indexOf(marker);
        if (offset < 0 || text.indexOf(marker, offset + marker.length) >= 0) {
            throw new Error(`Expected exactly one annotation marker: ${marker}`);
        }
        const display = annotation.type === "TTS"
            ? formatter.formatTts(annotation, {sourceText: originalText, glyphs})
            : formatter.formatMode(annotation, {sourceText: originalText, glyphs});
        text = text.slice(0, offset) + display + text.slice(offset + marker.length);
        annotations.push({
            ...structuredClone(annotation),
            position: {offset, length: display.length},
        });
        displays.push(display);
    }

    if (containsAnnotationMarker(text)) {
        throw new Error("Reserved annotation markers remain after restoration");
    }
    if (annotations.length !== translated.protectedAnnotations.length ||
        annotations.some((annotation, index) =>
            text.slice(annotation.position.offset,
                annotation.position.offset + annotation.position.length) !== displays[index])) {
        throw new Error("Restored annotation positions do not match display text");
    }

    return {
        ...(translated.metadata ? structuredClone(translated.metadata) : {}),
        type: "STEP",
        text,
        annotations,
    };
}
