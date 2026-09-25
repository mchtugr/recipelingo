import type {
  KnownModeName,
  ModeTemperature,
  Temperature,
} from "@/lib/cookidoo/types";
import type { AnnotationFormatter, AnnotationMessages } from "./types";

function validateNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Invalid ${label}: ${value}`);
  }
  return value;
}

function formatTime(seconds: number, messages: AnnotationMessages): string {
  validateNonNegativeInteger(seconds, "annotation time");
  return seconds >= 60 && seconds % 60 === 0
    ? `${seconds / 60} ${messages.units.minute}`
    : `${seconds} ${messages.units.second}`;
}

function formatTemperature(temperature: Temperature): string {
  if (temperature.value === "varoma") return "Varoma";
  if (temperature.unit !== "C" && temperature.unit !== "F") {
    throw new Error(
      `Unsupported annotation temperature unit: ${String(temperature.unit)}`,
    );
  }
  return `${temperature.value}°${temperature.unit}`;
}

function formatModeTemperature(temperature: ModeTemperature): string {
  if (temperature.unit === undefined) return temperature.value;
  if (temperature.unit !== "C" && temperature.unit !== "F") {
    throw new Error(
      `Unsupported MODE temperature unit: ${String(temperature.unit)}`,
    );
  }
  return `${temperature.value}°${temperature.unit}`;
}

const MODE_FIELDS: Record<
  KnownModeName,
  ReadonlySet<"time" | "temperature">
> = {
  egg_boiler: new Set(),
  blend: new Set(["time"]),
  rice_cooker: new Set(),
  sous_vide: new Set(["time", "temperature"]),
  slow_cook: new Set(["time", "temperature"]),
  browning: new Set(["time", "temperature"]),
  sugar_stages: new Set(["time"]),
  fermentation: new Set(["time", "temperature"]),
  dough: new Set(["time"]),
  thicken: new Set(["temperature"]),
  "open cooking": new Set(["time", "temperature"]),
  pre_clean: new Set(),
  warm_up: new Set(["temperature"]),
  kettle: new Set(["temperature"]),
  peeler: new Set(["time"]),
  turbo: new Set(["time"]),
  slicing: new Set(),
  grating: new Set(),
  spiralizing: new Set(),
};
const UNKNOWN_MODE_FIELDS = new Set<"time" | "temperature">();

function sourceVariant(
  name: string,
  sourceText: string | undefined,
): string | undefined {
  if ((name !== "slicing" && name !== "grating") || sourceText === undefined) {
    return undefined;
  }

  return sourceText.match(/\/\s*([^/]+?)\s*$/)?.[1];
}

export function createAnnotationFormatter(
  messages: AnnotationMessages,
): AnnotationFormatter {
  return {
    formatTts(annotation, context) {
      const { time, temperature, direction, speed } = annotation.data;
      const parts: string[] = [];
      const glyphs = context?.glyphs ?? [];
      let glyphIndex = 0;
      if (time !== undefined) parts.push(formatTime(time, messages));
      if (temperature !== undefined) parts.push(formatTemperature(temperature));
      if (direction === "CCW")
        parts.push(glyphs[glyphIndex++] ?? messages.labels.reverse);
      else if (direction !== undefined && direction !== "CW") {
        throw new Error(`Unsupported TTS direction: ${direction}`);
      }
      if (speed !== undefined) {
        if (!speed.trim()) throw new Error("Invalid TTS speed");
        const speedValue =
          speed === "soft" ? (glyphs[glyphIndex++] ?? speed) : speed;
        parts.push(`${messages.labels.speed} ${speedValue}`);
      }
      if (glyphIndex < glyphs.length) parts.push(...glyphs.slice(glyphIndex));
      if (parts.length === 0)
        throw new Error("TTS annotation has no display parameters");
      return parts.join("/");
    },

    formatMode(annotation, context) {
      const displayName = Object.prototype.hasOwnProperty.call(
        messages.modes,
        annotation.name,
      )
        ? (messages.modes[annotation.name as KnownModeName] ?? annotation.name)
        : annotation.name;
      const glyphs = context?.glyphs ?? [];
      const parts = [
        `${displayName}${glyphs.length ? ` ${glyphs.join(" ")}` : ""}`,
      ];
      const fields = Object.prototype.hasOwnProperty.call(
        MODE_FIELDS,
        annotation.name,
      )
        ? MODE_FIELDS[annotation.name as KnownModeName]
        : UNKNOWN_MODE_FIELDS;
      if (fields.has("time") && annotation.data?.time !== undefined) {
        parts.push(formatTime(annotation.data.time, messages));
      }
      if (
        fields.has("temperature") &&
        annotation.data?.temperature !== undefined
      ) {
        parts.push(formatModeTemperature(annotation.data.temperature));
      }
      if (
        annotation.name === "turbo" &&
        annotation.data?.pulseCount !== undefined
      ) {
        parts.push(
          messages.formatCount(
            validateNonNegativeInteger(
              annotation.data.pulseCount,
              "MODE pulse count",
            ),
          ),
        );
      }
      const variant = sourceVariant(annotation.name, context?.sourceText);
      if (variant !== undefined) parts.push(variant);
      return parts.join("/");
    },
  };
}
