import { promises as fs } from "fs";
import path from "path";
import { buildPublicMediaUrl } from "../../utils/media";
import { synthesizeSpeech } from "./tts";

const PREVIEW_DIR = "voice-preview";

export async function generateVoicePreview(voice?: string, text?: string) {
  const sample =
    text?.trim() ||
    "大家好，这是一段人声试听，用于预览音色与语速。";
  const tts = await synthesizeSpeech(sample, voice);
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
  const dir = path.join(baseDir, PREVIEW_DIR);
  await fs.mkdir(dir, { recursive: true });
  const filename = `voice-${tts.voiceUsed ?? "default"}-${Date.now()}.${tts.format}`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, tts.audioBuffer);

  return {
    voice: voice ?? tts.voiceUsed ?? "default",
    voice_used: tts.voiceUsed ?? "default",
    text: sample,
    audio_path: filePath,
    audio_url: buildPublicMediaUrl(filePath),
  };
}
