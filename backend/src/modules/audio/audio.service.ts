import { promises as fs } from "fs";
import path from "path";
import type { ScriptScene } from "../../utils/json";
import { synthesizeWithDashScope } from "./dashscopeTts";
import { recognizeWithDashScope } from "./dashscopeAsr";
import type { AudioGenerateResponse, AudioSceneResult } from "./audio.types";
import { probeAudioDurationMs } from "../../utils/audioProbe";
import { getVideoConfig } from "../../config/env";
import { mapWithConcurrency } from "../../utils/limit";

type AudioGenerateInput = {
  scenes: ScriptScene[];
  voice?: string;
};

const AUDIO_DIR = "audio";

async function ensureAudioDir(): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? "";
  const resolvedBase = baseDir || path.resolve(process.cwd(), "storage");
  const audioDir = path.join(resolvedBase, AUDIO_DIR);
  await fs.mkdir(audioDir, { recursive: true });
  return audioDir;
}

function estimateNarrationDurationMs(text: string): number {
  const config = getVideoConfig();
  const normalized = text.replace(/\s+/g, "");
  const estimated =
    (normalized.length / config.charsPerSecond) * 1000 + 400;
  return Math.round(
    Math.min(
      config.maxSceneDurationMs,
      Math.max(config.minSceneDurationMs, estimated)
    )
  );
}

function createFallbackTimestamps(
  text: string,
  durationMs: number
): AudioSceneResult["timestamps"] {
  const chunks = text
    .split(/(?<=[。！？!?，,；;：:])/)
    .map((item) => item.trim())
    .filter(Boolean);
  const units = chunks.length > 0 ? chunks : text.split("").filter(Boolean);
  if (units.length === 0) {
    return [{ text, begin_ms: 0, end_ms: durationMs }];
  }

  const slice = durationMs / units.length;
  return units.map((unit, index) => {
    const begin = Math.round(index * slice);
    const end =
      index === units.length - 1
        ? durationMs
        : Math.max(begin + 120, Math.round((index + 1) * slice));
    return {
      text: unit,
      begin_ms: begin,
      end_ms: Math.min(durationMs, end),
    };
  });
}

function normalizeTimestamps(
  text: string,
  timestamps: AudioSceneResult["timestamps"],
  durationMs: number,
  asrDurationMs: number
): AudioSceneResult["timestamps"] {
  if (timestamps.length === 0) {
    return createFallbackTimestamps(text, durationMs);
  }

  const sourceDuration =
    asrDurationMs > 0
      ? asrDurationMs
      : timestamps[timestamps.length - 1]?.end_ms ?? durationMs;
  const scale =
    sourceDuration > 0 ? Math.min(4, Math.max(0.1, durationMs / sourceDuration)) : 1;
  const normalized: AudioSceneResult["timestamps"] = [];
  timestamps.forEach((stamp: AudioSceneResult["timestamps"][number]) => {
    const previousEnd = normalized[normalized.length - 1]?.end_ms ?? 0;
    const rawBegin = Math.round(stamp.begin_ms * scale);
    const rawEnd = Math.round(stamp.end_ms * scale);
    const begin = Math.min(durationMs, Math.max(previousEnd, rawBegin));
    const end = Math.min(durationMs, Math.max(begin + 80, rawEnd));
    normalized.push({
      text: stamp.text,
      begin_ms: begin,
      end_ms: end,
    });
  });

  if (
    normalized.every(
      (stamp: AudioSceneResult["timestamps"][number]) => stamp.begin_ms === stamp.end_ms
    )
  ) {
    return createFallbackTimestamps(text, durationMs);
  }

  normalized[normalized.length - 1].end_ms = durationMs;
  return normalized;
}

function sanitizeSceneTiming(
  text: string,
  probedDurationMs: number | null,
  asrDurationMs: number,
  timestamps: AudioSceneResult["timestamps"]
): Pick<AudioSceneResult, "duration_ms" | "timestamps"> {
  const config = getVideoConfig();
  const estimatedDurationMs = estimateNarrationDurationMs(text);
  const reliableProbe =
    typeof probedDurationMs === "number" &&
    Number.isFinite(probedDurationMs) &&
    probedDurationMs > 0;
  const reliableAsr =
    Number.isFinite(asrDurationMs) &&
    asrDurationMs >= config.minSceneDurationMs / 2 &&
    asrDurationMs <= config.maxSceneDurationMs * 2;

  let durationMs = reliableProbe
    ? probedDurationMs!
    : reliableAsr
      ? asrDurationMs
      : estimatedDurationMs;

  if (reliableProbe && reliableAsr && asrDurationMs > probedDurationMs! * 2.5) {
    durationMs = probedDurationMs!;
  }

  durationMs = Math.round(
    Math.min(
      config.maxSceneDurationMs,
      Math.max(config.minSceneDurationMs, durationMs)
    )
  );

  return {
    duration_ms: durationMs,
    timestamps: normalizeTimestamps(text, timestamps, durationMs, asrDurationMs),
  };
}

export async function generateAudioAndTimestamps(
  input: AudioGenerateInput
): Promise<AudioGenerateResponse> {
  const audioDir = await ensureAudioDir();
  const config = getVideoConfig();

  const results = await mapWithConcurrency(
    input.scenes,
    config.audioConcurrency,
    async (scene: ScriptScene) => {
      let tts = null;
      let voiceUsed = input.voice;
      try {
        tts = await synthesizeWithDashScope(scene.narration_text, input.voice);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (input.voice && message.includes("418")) {
          tts = await synthesizeWithDashScope(scene.narration_text, undefined);
          voiceUsed = undefined;
        } else {
          throw error;
        }
      }
      const filename = `scene-${scene.scene_id}-${Date.now()}.${tts.format}`;
      const audioPath = path.join(audioDir, filename);
      await fs.writeFile(audioPath, tts.audioBuffer);

      const [asr, probedDuration] = await Promise.all([
        recognizeWithDashScope(audioPath),
        probeAudioDurationMs(audioPath).catch(() => null),
      ]);
      const timing = sanitizeSceneTiming(
        scene.narration_text,
        probedDuration,
        asr.durationMs,
        asr.timestamps
      );

      return {
        scene_id: scene.scene_id,
        narration_text: scene.narration_text,
        voice: voiceUsed,
        audio_path: audioPath,
        audio_format: tts.format,
        sample_rate: tts.sampleRate,
        duration_ms: timing.duration_ms,
        timestamps: timing.timestamps,
      };
    }
  );

  return { scenes: results };
}
