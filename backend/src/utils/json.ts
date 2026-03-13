export type ScriptScene = {
  scene_id: number;
  narration_text: string;
  image_prompt: string;
};

export type ScriptPayload = {
  scenes: ScriptScene[];
};

function sanitizeJsonString(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/,\s*([}\]])/g, "$1");
}

function extractJsonCandidate(text: string): string {
  const fenced =
    text.match(/```json\s*([\s\S]*?)```/i) ??
    text.match(/```\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1];
  }

  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else {
    start = Math.max(firstBrace, firstBracket);
  }
  if (start === -1) {
    return text;
  }

  const lastBrace = text.lastIndexOf("}");
  const lastBracket = text.lastIndexOf("]");
  let end = -1;
  if (lastBrace !== -1 && lastBracket !== -1) {
    end = Math.max(lastBrace, lastBracket);
  } else {
    end = Math.max(lastBrace, lastBracket);
  }
  if (end === -1 || end <= start) {
    return text;
  }

  return text.slice(start, end + 1);
}

export function parseJsonFromModel(text: string): unknown {
  const candidate = sanitizeJsonString(extractJsonCandidate(text));
  try {
    return JSON.parse(candidate);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from model output. Raw snippet: ${candidate.slice(
        0,
        200
      )}`
    );
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeScriptPayload(raw: unknown): ScriptPayload {
  const scenesRaw = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && "scenes" in raw
    ? (raw as { scenes: unknown }).scenes
    : null;

  if (!Array.isArray(scenesRaw)) {
    throw new Error("JSON must be an array or an object with a scenes array.");
  }

  const scenes: ScriptScene[] = scenesRaw.map((scene, index) => {
    if (typeof scene !== "object" || scene === null) {
      throw new Error(`Scene ${index + 1} is not an object.`);
    }
    const sceneId = toNumber((scene as { scene_id?: unknown }).scene_id);
    const narrationText = (scene as { narration_text?: unknown }).narration_text;
    const imagePrompt = (scene as { image_prompt?: unknown }).image_prompt;

    if (sceneId === null) {
      throw new Error(`Scene ${index + 1} missing scene_id.`);
    }
    if (typeof narrationText !== "string" || narrationText.trim() === "") {
      throw new Error(`Scene ${index + 1} missing narration_text.`);
    }
    if (typeof imagePrompt !== "string" || imagePrompt.trim() === "") {
      throw new Error(`Scene ${index + 1} missing image_prompt.`);
    }

    return {
      scene_id: sceneId,
      narration_text: narrationText.trim(),
      image_prompt: imagePrompt.trim(),
    };
  });

  if (scenes.length === 0) {
    throw new Error("Scenes array is empty.");
  }

  return { scenes };
}
