import {
    isProtectedCookingAnnotation,
    type Instruction,
    type ProtectedCookingAnnotation,
} from "../cookidoo/types";
import {
    containsAnnotationMarker,
    createAnnotationMarker,
} from "./markers";

export interface ProtectedAnnotation {
    marker: string;
    originalText: string;
    annotation: ProtectedCookingAnnotation;
}

export interface PreparedInstruction {
    text: string;
    protectedAnnotations: ProtectedAnnotation[];
    /** Safe instruction-level fields; source annotation positions are excluded. */
    metadata?: Omit<Instruction, "text" | "annotations">;
}

export function prepareInstruction(
    instruction: Instruction,
): PreparedInstruction {
    if (containsAnnotationMarker(instruction.text)) {
        throw new Error(
            "Instruction already contains reserved annotation marker syntax",
        );
    }

    const annotations = instruction.annotations
        .filter(isProtectedCookingAnnotation)
        .sort(
            (a, b) =>
                a.position.offset -
                b.position.offset,
        );

    for (const annotation of annotations) {
        const {offset, length} = annotation.position;
        if (
            !Number.isSafeInteger(offset) || !Number.isSafeInteger(length) ||
            offset < 0 || length <= 0 || offset + length > instruction.text.length
        ) {
            throw new RangeError(
                `Invalid ${annotation.type} annotation range: offset ${offset}, length ${length}`,
            );
        }
    }
    for (let i = 1; i < annotations.length; i++) {
        const previous = annotations[i - 1]!;
        const current = annotations[i]!;

        const previousEnd =
            previous.position.offset +
            previous.position.length;

        if (
            current.position.offset <
            previousEnd
        ) {
            throw new RangeError(
                `Overlapping ${previous.type} and ${current.type} annotation ranges`,
            );
        }
    }

    const protectedAnnotations = annotations.map((annotation, index) => ({
            marker:
                createAnnotationMarker(
                    index,
                ),

            originalText: instruction.text.slice(
                annotation.position.offset,
                annotation.position.offset + annotation.position.length,
            ),

            annotation:
                structuredClone(
                    annotation,
                ),
        }),
    );

    let text = instruction.text;
    for (let i = protectedAnnotations.length - 1; i >= 0; i--) {
        const annotation =
            annotations[i]!;

        const protectedAnnotation =
            protectedAnnotations[i]!;

        const {offset, length} =
            annotation.position;

        text =
            text.slice(0, offset) +
            protectedAnnotation.marker +
            text.slice(offset + length);
    }

    const {text: _sourceText, annotations: _sourceAnnotations, ...metadata} = instruction;
    return {
        text,
        protectedAnnotations,
        ...(Object.keys(metadata).some((key) => key !== "type")
            ? {metadata: structuredClone(metadata)} : {}),
    };
}
