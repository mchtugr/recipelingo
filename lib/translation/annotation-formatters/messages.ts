import type {AnnotationMessages} from "./types";

export const ANNOTATION_MESSAGES = {
    tr: {
        units: {second: "sn", minute: "dk"},
        labels: {speed: "hız", reverse: "ters yön"},
        modes: {dough: "Hamur", turbo: "Turbo"},
        formatCount: (count) => `${count} kez`
    },
    en: {
        units: {second: "sec", minute: "min"},
        labels: {speed: "speed", reverse: "reverse"},
        modes: {dough: "Dough", turbo: "Turbo"},
        formatCount: (count) => `${count} ${count === 1 ? "time" : "times"}`
    },
    de: {
        units: {second: "Sek.", minute: "Min."},
        labels: {speed: "Stufe", reverse: "Linkslauf"},
        modes: {dough: "Teig", turbo: "Turbo"},
        formatCount: (count) => `${count} Mal`
    },
    fr: {
        units: {second: "s", minute: "min"},
        labels: {speed: "vitesse", reverse: "sens inverse"},
        modes: {dough: "Pétrin", turbo: "Turbo"},
        formatCount: (count) => `${count} fois`
    },
    es: {
        units: {second: "s", minute: "min"},
        labels: {speed: "velocidad", reverse: "giro inverso"},
        modes: {dough: "Amasar", turbo: "Turbo"},
        formatCount: (count) => `${count} ${count === 1 ? "vez" : "veces"}`
    },
    it: {
        units: {second: "sec", minute: "min"},
        labels: {speed: "velocità", reverse: "antiorario"},
        modes: {dough: "Impasto", turbo: "Turbo"},
        formatCount: (count) => `${count} ${count === 1 ? "volta" : "volte"}`
    },
} satisfies Record<string, AnnotationMessages>;

export type SupportedAnnotationLanguage = keyof typeof ANNOTATION_MESSAGES;
