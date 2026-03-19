import { promises as fs } from "fs";
import path from "path";
import type { ScriptScene } from "../../utils/json";
import { recognizeWithDashScope } from "./dashscopeAsr";
import { recognizeWithFasterWhisper } from "./fasterWhisperAsr";
import type { AudioGenerateResponse, AudioSceneResult } from "./audio.types";
import { probeAudioDurationMs } from "../../utils/audioProbe";
import { env, getAudioConfig, getVideoConfig } from "../../config/env";
import { mapWithConcurrency } from "../../utils/limit";
import { synthesizeSpeech } from "./tts";

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

function splitNarration(text: string): string[] {
  const chunks = text
    .split(/(?<=[。！？!?，,；;：:])/)
    .map((item) => item.trim())
    .filter(Boolean);
  return chunks.length > 0 ? chunks : text.split("").filter(Boolean);
}

function createTextBasedTimestamps(
  text: string,
  durationMs: number
): AudioSceneResult["timestamps"] {
  const units = splitNarration(text);
  if (units.length === 0) {
    return [{ text, begin_ms: 0, end_ms: durationMs }];
  }

  const weights = units.map((unit) => {
    const contentLength = unit.replace(/[，。！？!?；;：:\s]/g, "").length;
    const pauseBonus = /[。！？!?]/.test(unit)
      ? 2.4
      : /[，,；;：:]/.test(unit)
        ? 1.4
        : 1;
    return Math.max(1, contentLength + pauseBonus);
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  return units.map((unit, index) => {
    const ratio = weights[index] / totalWeight;
    const segmentDuration =
      index === units.length - 1
        ? durationMs - cursor
        : Math.max(220, Math.round(durationMs * ratio));
    const begin = cursor;
    const end = Math.min(durationMs, begin + segmentDuration);
    cursor = end;
    return {
      text: unit,
      begin_ms: begin,
      end_ms: end,
    };
  });
}

function normalizeComparableText(text: string): string {
  return text
    .replace(/[，。！？!?；;：:“”"、,.]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function longestCommonSubsequenceLength(a: string, b: string): number {
  if (!a || !b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function getTextSimilarity(expectedText: string, recognizedText: string): number {
  const expected = normalizeComparableText(expectedText);
  const recognized = normalizeComparableText(recognizedText);
  if (!expected || !recognized) return 0;
  const lcs = longestCommonSubsequenceLength(expected, recognized);
  return lcs / Math.max(expected.length, recognized.length);
}

function sanitizeSceneTiming(
  text: string,
  probedDurationMs: number | null,
  asrDurationMs: number
): Pick<AudioSceneResult, "duration_ms" | "timestamps" | "timing_source"> {
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
    timestamps: createTextBasedTimestamps(text, durationMs),
    timing_source: "text",
  };
}

function shouldRetryTts(
  text: string,
  audioBuffer: Buffer,
  durationMs: number,
  recognizedText: string
): boolean {
  const estimatedDurationMs = estimateNarrationDurationMs(text);
  if (audioBuffer.byteLength < 2048) {
    return true;
  }
  if (durationMs < Math.max(700, estimatedDurationMs * 0.45)) {
    return true;
  }
  const similarity = getTextSimilarity(text, recognizedText);
  return similarity > 0 && similarity < 0.45 && durationMs < estimatedDurationMs * 0.8;
}

async function recognizeWithFallback(
  audioPath: string
): Promise<{
  timestamps: AudioSceneResult["timestamps"];
  durationMs: number;
  recognizedText: string;
}> {
  const audioConfig = getAudioConfig();

  if (audioConfig.asrProvider === "faster_whisper") {
    try {
      return await recognizeWithFasterWhisper(audioPath);
    } catch (error) {
      if (env.dashscopeApiKey) {
        return recognizeWithDashScope(audioPath);
      }
      throw error;
    }
  }

  try {
    return await recognizeWithDashScope(audioPath);
  } catch (error) {
    try {
      return await recognizeWithFasterWhisper(audioPath);
    } catch {
      throw error;
    }
  }
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
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const tts = await synthesizeSpeech(scene.narration_text, input.voice);
        const filename = `scene-${scene.scene_id}-${Date.now()}-${attempt}.${tts.format}`;
        const audioPath = path.join(audioDir, filename);
        await fs.writeFile(audioPath, tts.audioBuffer);

        const [asr, probedDuration] = await Promise.all([
          recognizeWithFallback(audioPath).catch(() => ({
            timestamps: [] as AudioSceneResult["timestamps"],
            durationMs: 0,
            recognizedText: "",
          })),
          probeAudioDurationMs(audioPath).catch(() => null),
        ]);
        const recognizedText =
          asr.recognizedText || asr.timestamps.map((stamp) => stamp.text).join("");
        const timing = sanitizeSceneTiming(
          scene.narration_text,
          probedDuration,
          asr.durationMs
        );

        if (
          attempt < 2 &&
          shouldRetryTts(
            scene.narration_text,
            tts.audioBuffer,
            timing.duration_ms,
            recognizedText
          )
        ) {
          continue;
        }

        return {
          scene_id: scene.scene_id,
          narration_text: scene.narration_text,
          recognized_text: recognizedText || undefined,
          timing_source: timing.timing_source,
          voice: tts.voiceUsed,
          audio_path: audioPath,
          audio_format: tts.format,
          sample_rate: tts.sampleRate,
          duration_ms: timing.duration_ms,
          timestamps: timing.timestamps,
        };
      }

      throw new Error(`Failed to generate valid audio for scene ${scene.scene_id}.`);
    }
  );

  return { scenes: results };
}
