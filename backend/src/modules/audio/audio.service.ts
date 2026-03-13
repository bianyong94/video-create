import { promises as fs } from "fs";
import path from "path";
import type { ScriptScene } from "../../utils/json";
import { synthesizeWithDashScope } from "./dashscopeTts";
import { recognizeWithDashScope } from "./dashscopeAsr";
import type { AudioGenerateResponse, AudioSceneResult } from "./audio.types";
import { probeAudioDurationMs } from "../../utils/audioProbe";

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

export async function generateAudioAndTimestamps(
  input: AudioGenerateInput
): Promise<AudioGenerateResponse> {
  const audioDir = await ensureAudioDir();
  const results: AudioSceneResult[] = [];

  for (const scene of input.scenes) {
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

    const asr = await recognizeWithDashScope(audioPath);
    let probedDuration: number | null = null;
    try {
      probedDuration = await probeAudioDurationMs(audioPath);
    } catch {
      probedDuration = null;
    }
    const durationMs = probedDuration ?? asr.durationMs;

    results.push({
      scene_id: scene.scene_id,
      narration_text: scene.narration_text,
      voice: voiceUsed,
      audio_path: audioPath,
      audio_format: tts.format,
      sample_rate: tts.sampleRate,
      duration_ms: durationMs,
      timestamps: asr.timestamps,
    });
  }

  return { scenes: results };
}
