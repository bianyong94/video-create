export type AspectRatio = "portrait" | "landscape";

export function normalizeAspectRatio(value?: string): AspectRatio {
  return value === "landscape" ? "landscape" : "portrait";
}

export function getAspectDimensions(
  aspectRatio: AspectRatio,
  baseWidth: number,
  baseHeight: number
): { width: number; height: number } {
  const width = Math.max(1, Math.round(baseWidth));
  const height = Math.max(1, Math.round(baseHeight));

  if (aspectRatio === "landscape") {
    return width >= height
      ? { width, height }
      : { width: height, height: width };
  }

  return width <= height
    ? { width, height }
    : { width: height, height: width };
}

export function aspectRatioToCss(aspectRatio: AspectRatio): string {
  return aspectRatio === "landscape" ? "16 / 9" : "9 / 16";
}

