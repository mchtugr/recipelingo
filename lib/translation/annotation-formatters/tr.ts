import type {AnnotationFormatter} from "./types";

function formatTime(seconds: number): string {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new RangeError(`Invalid annotation time: ${seconds}`);
  }
  return seconds >= 60 && seconds % 60 === 0
    ? `${seconds / 60} dk` : `${seconds} sn`;
}

export const trAnnotationFormatter: AnnotationFormatter = {
  formatTts(annotation) {
    const {time, temperature, direction, speed} = annotation.data;
    const parts: string[] = [];
    if (time !== undefined) parts.push(formatTime(time));
    if (temperature !== undefined) {
      if (temperature.value === "varoma") {
        parts.push("Varoma");
      } else {
        if (temperature.unit !== "C" && temperature.unit !== "F") {
          throw new Error(
            `Unsupported TTS temperature unit: ${String(temperature.unit)}`,
          );
        }

        parts.push(`${temperature.value}°${temperature.unit}`);
      }
    }
    if (direction === "CCW") parts.push("ters yön");
    else if (direction !== undefined && direction !== "CW") {
      throw new Error(`Unsupported TTS direction: ${direction}`);
    }
    if (speed !== undefined) {
      if (!speed.trim()) {
        throw new Error("Invalid TTS speed");
      }

      parts.push(`hız ${speed}`);
    }
    if (parts.length === 0) throw new Error("TTS annotation has no display parameters");
    return parts.join("/");
  },

  formatMode(annotation) {
    if (annotation.name !== "dough" && annotation.name !== "turbo") {
      throw new Error(`Unsupported MODE annotation: ${annotation.name}`);
    }
    const parts = [annotation.name === "dough" ? "Hamur" : "Turbo"];
    if (annotation.data.time !== undefined) parts.push(formatTime(annotation.data.time));
    if (annotation.name === "turbo" && annotation.data.pulseCount !== undefined) {
      if (!Number.isSafeInteger(annotation.data.pulseCount) || annotation.data.pulseCount < 0) {
        throw new RangeError(`Invalid MODE pulse count: ${annotation.data.pulseCount}`);
      }
      parts.push(`${annotation.data.pulseCount} kez`);
    }
    return parts.join("/");
  },
};
