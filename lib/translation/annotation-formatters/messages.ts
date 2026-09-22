import type {AnnotationMessages} from "./types";

export const ANNOTATION_MESSAGES = {
    tr: {
        units: {second: "sn", minute: "dk"},
        labels: {speed: "hız", reverse: "ters yön"},
        modes: {dough: "Hamur", turbo: "Turbo", blend: "Karıştırma", warm_up: "Isıtma", rice_cooker: "Pilav Pişirici"},
        formatCount: (count) => `${count} kez`
    },
    en: {
        units: {second: "sec", minute: "min"},
        labels: {speed: "speed", reverse: "reverse"},
        modes: {dough: "Dough", turbo: "Turbo", blend: "Blend", warm_up: "Warm Up", rice_cooker: "Rice Cooker"},
        formatCount: (count) => `${count} ${count === 1 ? "time" : "times"}`
    },
    de: {
        units: {second: "Sek.", minute: "Min."},
        labels: {speed: "Stufe", reverse: "Linkslauf"},
        modes: {dough: "Teig", turbo: "Turbo", blend: "Mixen", warm_up: "Erwärmen", rice_cooker: "Reiskocher"},
        formatCount: (count) => `${count} Mal`
    },
    fr: {
        units: {second: "s", minute: "min"},
        labels: {speed: "vitesse", reverse: "sens inverse"},
        modes: {dough: "Pétrin", turbo: "Turbo", blend: "Mixer", warm_up: "Réchauffer", rice_cooker: "Cuiseur à riz"},
        formatCount: (count) => `${count} fois`
    },
    es: {
        units: {second: "s", minute: "min"},
        labels: {speed: "velocidad", reverse: "giro inverso"},
        modes: {dough: "Amasar", turbo: "Turbo", blend: "Triturar", warm_up: "Calentar", rice_cooker: "Cocer arroz"},
        formatCount: (count) => `${count} ${count === 1 ? "vez" : "veces"}`
    },
    it: {
        units: {second: "sec", minute: "min"},
        labels: {speed: "velocità", reverse: "antiorario"},
        modes: {dough: "Impasto", turbo: "Turbo", blend: "Frullare", warm_up: "Riscaldare", rice_cooker: "Cuociriso"},
        formatCount: (count) => `${count} ${count === 1 ? "volta" : "volte"}`
    },
} satisfies Record<string, AnnotationMessages>;

export type SupportedAnnotationLanguage = keyof typeof ANNOTATION_MESSAGES;
