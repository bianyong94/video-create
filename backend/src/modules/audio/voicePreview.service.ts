import { promises as fs } from "fs";
import path from "path";
import { synthesizeWithDashScope } from "./dashscopeTts";
import { buildPublicMediaUrl } from "../../utils/media";

const PREVIEW_DIR = "voice-preview";

export async function generateVoicePreview(voice?: string, text?: string) {
  const sample =
    text?.trim() ||
    "大家好，这是一段人声试听，用于预览音色与语速。";
  let tts = null;
  try {
    tts = await synthesizeWithDashScope(sample, voice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (voice && message.includes("418")) {
      tts = await synthesizeWithDashScope(sample, undefined);
      voice = undefined;
    } else {
      throw error;
    }
  }
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
  const dir = path.join(baseDir, PREVIEW_DIR);
  await fs.mkdir(dir, { recursive: true });
  const filename = `voice-${voice ?? "default"}-${Date.now()}.${tts.format}`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, tts.audioBuffer);

  return {
    voice: voice ?? "default",
    voice_used: voice ?? "default",
    text: sample,
    audio_path: filePath,
    audio_url: buildPublicMediaUrl(filePath),
  };
}
