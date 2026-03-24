import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile as execFileCallback } from "child_process";
import { promisify } from "util";

const execFile = promisify(execFileCallback);
const YT_DLP_PYTHON_BIN = process.env.YT_DLP_PYTHON_BIN ?? "python3";
const SUBTITLE_LANGS = process.env.YOUTUBE_SUBTITLE_LANGS ?? "zh-Hans.*,zh-Hant.*,zh.*,en.*";

type TranscriptSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscriptMatch = {
  transcriptMatchScore: number;
  transcriptMatchedText?: string;
  clipStartSec?: number;
  clipEndSec?: number;
  transcriptReason?: string;
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^A-Za-z0-9\u4e00-\u9fff\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function extractChineseTokens(text: string): string[] {
  const normalized = normalizeText(text);
  const seqs = normalized.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const tokens: string[] = [];
  for (const seq of seqs) {
    if (seq.length <= 4) {
      tokens.push(seq);
      continue;
    }
    for (let i = 0; i < seq.length - 1; i += 1) {
      const bi = seq.slice(i, i + 2);
      if (bi.length === 2) tokens.push(bi);
    }
    for (let i = 0; i < seq.length - 2; i += 1) {
      const tri = seq.slice(i, i + 3);
      if (tri.length === 3) tokens.push(tri);
    }
  }
  return unique(tokens).slice(0, 40);
}

function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  const latin = normalized
    .split(" ")
    .filter((token) => token.length >= 2)
    .slice(0, 30);
  return unique([...latin, ...extractChineseTokens(normalized)]).slice(0, 50);
}

function parseTime(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const parts = normalized.split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] ?? 0;
}

function parseVtt(content: string): TranscriptSegment[] {
  const blocks = content
    .replace(/^WEBVTT\s*/i, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments: TranscriptSegment[] = [];
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const timeLine = lines.find((line) => line.includes("-->") && /\d/.test(line));
    if (!timeLine) continue;
    const [startRaw, endRaw] = timeLine.split("-->").map((part) => part.trim().split(" ")[0]);
    const text = lines
      .filter((line) => line !== timeLine && !/^\d+$/.test(line))
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const startSec = parseTime(startRaw);
    const endSec = parseTime(endRaw);
    if (endSec <= startSec) continue;
    segments.push({ startSec, endSec, text });
  }
  return segments;
}

async function ensureTranscriptCacheDir(): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
  const cacheDir = path.join(baseDir, "youtube-transcripts");
  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

function extractVideoId(videoUrl: string): string | null {
  const match = videoUrl.match(/[?&]v=([^&]+)/) ?? videoUrl.match(/youtu\.be\/([^?&/]+)/);
  return match?.[1] ?? null;
}

async function readCachedTranscript(videoId: string): Promise<TranscriptSegment[] | null> {
  const cacheDir = await ensureTranscriptCacheDir();
  const filePath = path.join(cacheDir, `${videoId}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as TranscriptSegment[];
  } catch {
    return null;
  }
}

async function writeCachedTranscript(videoId: string, segments: TranscriptSegment[]): Promise<void> {
  const cacheDir = await ensureTranscriptCacheDir();
  const filePath = path.join(cacheDir, `${videoId}.json`);
  await fs.writeFile(filePath, JSON.stringify(segments), "utf8");
}

export async function fetchYoutubeTranscript(videoUrl: string): Promise<TranscriptSegment[]> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error("Unable to extract YouTube video ID.");
  }

  const cached = await readCachedTranscript(videoId);
  if (cached?.length) return cached;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `yt-transcript-${videoId}-`));
  const outputTemplate = path.join(tempDir, `${videoId}.%(ext)s`);
  try {
    await execFile(
      YT_DLP_PYTHON_BIN,
      [
        "-m",
        "yt_dlp",
        "--skip-download",
        "--write-auto-subs",
        "--write-subs",
        "--sub-langs",
        SUBTITLE_LANGS,
        "--sub-format",
        "vtt",
        "-o",
        outputTemplate,
        videoUrl,
      ],
      { maxBuffer: 20 * 1024 * 1024 }
    );

    const files = await fs.readdir(tempDir);
    const subtitleFile = files.find((file) => file.startsWith(videoId) && file.endsWith(".vtt"));
    if (!subtitleFile) {
      throw new Error("No subtitle file generated.");
    }

    const content = await fs.readFile(path.join(tempDir, subtitleFile), "utf8");
    const segments = parseVtt(content);
    if (!segments.length) {
      throw new Error("Subtitle file is empty.");
    }
    await writeCachedTranscript(videoId, segments);
    return segments;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function scoreTranscriptMatch(query: string, segments: TranscriptSegment[]): TranscriptMatch {
  const queryTokens = tokenize(query);
  if (!queryTokens.length || !segments.length) {
    return { transcriptMatchScore: 0 };
  }

  let bestScore = 0;
  let bestStart = 0;
  let bestEnd = 0;
  let bestText = "";

  for (let index = 0; index < segments.length; index += 1) {
    const window = segments.slice(index, index + 3);
    const windowText = window.map((segment) => segment.text).join(" ");
    const haystack = normalizeText(windowText);
    const matched = queryTokens.filter((token) => haystack.includes(token));
    if (!matched.length) continue;

    let score = matched.length * 8;
    if (/秦始皇|统一六国|郡县制|中央集权|中国地图|中国版图|疆域|版图/.test(windowText)) {
      score += 15;
    }
    if (window.length) {
      const duration = window[window.length - 1].endSec - window[0].startSec;
      if (duration >= 4 && duration <= 16) score += 8;
      else if (duration > 30) score -= 5;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = window[0].startSec;
      bestEnd = window[window.length - 1].endSec;
      bestText = windowText;
    }
  }

  if (!bestScore) {
    return { transcriptMatchScore: 0 };
  }

  return {
    transcriptMatchScore: Math.min(100, bestScore),
    transcriptMatchedText: bestText.slice(0, 180),
    clipStartSec: Math.max(0, Math.floor(bestStart)),
    clipEndSec: Math.max(bestStart + 4, Math.ceil(bestEnd)),
    transcriptReason: "字幕正文命中当前镜头关键词",
  };
}
