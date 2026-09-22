import type {Temperature} from "../../cookidoo/types";
import type {AnnotationFormatter, AnnotationMessages} from "./types";

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
    throw new Error(`Unsupported annotation temperature unit: ${String(temperature.unit)}`);
  }
  return `${temperature.value}°${temperature.unit}`;
}

export function createAnnotationFormatter(messages: AnnotationMessages): AnnotationFormatter {
  return {
    formatTts(annotation, context) {
      const {time, temperature, direction, speed} = annotation.data;
      const parts: string[] = [];
      const glyphs = context?.glyphs ?? [];
      let glyphIndex = 0;
      if (time !== undefined) parts.push(formatTime(time, messages));
      if (temperature !== undefined) parts.push(formatTemperature(temperature));
      if (direction === "CCW") parts.push(glyphs[glyphIndex++] ?? messages.labels.reverse);
      else if (direction !== undefined && direction !== "CW") {
        throw new Error(`Unsupported TTS direction: ${direction}`);
      }
      if (speed !== undefined) {
        if (!speed.trim()) throw new Error("Invalid TTS speed");
        const speedValue = speed === "soft" ? glyphs[glyphIndex++] ?? speed : speed;
        parts.push(`${messages.labels.speed} ${speedValue}`);
      }
      if (glyphIndex < glyphs.length) parts.push(...glyphs.slice(glyphIndex));
      if (parts.length === 0) throw new Error("TTS annotation has no display parameters");
      return parts.join("/");
    },

    formatMode(annotation, context) {
      const displayName = Object.prototype.hasOwnProperty.call(messages.modes, annotation.name)
        ? messages.modes[annotation.name as keyof typeof messages.modes]
        : annotation.name;
      const glyphs = context?.glyphs ?? [];
      const parts = [`${displayName}${glyphs.length ? ` ${glyphs.join(" ")}` : ""}`];
      if (annotation.data?.time !== undefined) parts.push(formatTime(annotation.data.time, messages));
      if (annotation.data?.temperature !== undefined) {
        parts.push(formatTemperature(annotation.data.temperature));
      }
      if (annotation.name === "turbo" && annotation.data?.pulseCount !== undefined) {
        parts.push(messages.formatCount(validateNonNegativeInteger(
          annotation.data.pulseCount,
          "MODE pulse count",
        )));
      }
      return parts.join("/");
    },
  };
}
