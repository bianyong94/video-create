import { promises as fs } from "fs";
import path from "path";

const AUDIO_EXT = /\.(mp3|wav|aac|m4a|flac)$/i;

function getBgmDir(): string {
  return process.env.BGM_DIR ?? path.resolve(process.cwd(), "storage", "bgm");
}

export async function listMusicStyles(): Promise<string[]> {
  const bgmDir = getBgmDir();
  try {
    const entries = await fs.readdir(bgmDir, { withFileTypes: true });
    const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    if (folders.length > 0) {
      return folders;
    }
    const files = entries.filter((entry) => entry.isFile() && AUDIO_EXT.test(entry.name));
    if (files.length > 0) {
      return ["default"];
    }
    return [];
  } catch {
    return [];
  }
}

export async function pickBgm(style?: string): Promise<string | null> {
  const bgmDir = getBgmDir();
  try {
    if (!style || style === "default") {
      const files = await fs.readdir(bgmDir);
      const candidates = files.filter((file) => AUDIO_EXT.test(file));
      if (candidates.length === 0) return null;
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      return path.join(bgmDir, choice);
    }
    const styleDir = path.join(bgmDir, style);
    const files = await fs.readdir(styleDir);
    const candidates = files.filter((file) => AUDIO_EXT.test(file));
    if (candidates.length === 0) return null;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    return path.join(styleDir, choice);
  } catch {
    return null;
  }
}
