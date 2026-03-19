import { promises as fs } from "fs";
import { execFile as execFileCallback } from "child_process";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import type { ScriptScene } from "../../utils/json";
import { mapWithConcurrency } from "../../utils/limit";
import {
  materializeCandidate,
  searchRankedCandidates,
} from "../visual/imageProviders";
import { normalizeAspectRatio } from "../../utils/aspectRatio";
import {
  buildSceneSearchPlan,
  evaluateSearchCandidate,
} from "../visual/searchPlanner";
import { promisify } from "util";
import type {
  VideoCandidateSearchInput,
  VideoCandidateSearchResult,
} from "./videoCandidates.types";

const execFile = promisify(execFileCallback);
const PREVIEW_SECONDS = 8;
const PREVIEW_DIR = "video-previews";
const YOUTUBE_PLAYER_CLIENTS = [
  "android",
  "android,web",
  "android,web,ios",
  "mweb",
  "web",
];

function shouldDownloadYoutubePreview(): boolean {
  return (process.env.YOUTUBE_PREVIEW_MODE ?? "thumbnail").toLowerCase() === "download";
}
function clampCount(count?: number): number {
  if (!Number.isFinite(count)) return 8;
  return Math.min(20, Math.max(1, Math.trunc(count ?? 8)));
}

function buildSyntheticScene(query: string): ScriptScene {
  return {
    scene_id: 1,
    narration_text: query,
    image_prompt: query,
    stock_query: query,
  };
}

async function ensurePreviewDir(): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? "";
  const resolvedBase = baseDir || path.resolve(process.cwd(), "storage");
  const previewDir = path.join(resolvedBase, PREVIEW_DIR);
  await fs.mkdir(previewDir, { recursive: true });
  return previewDir;
}

async function createPreviewClip(
  sourcePath: string,
  targetPath: string,
  seconds: number,
  startSeconds = 0
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(sourcePath)
      .seekInput(Math.max(0, startSeconds))
      .outputOptions([
        "-an",
        "-t",
        String(seconds),
        "-c:v libx264",
        "-preset veryfast",
        "-crf 28",
        "-pix_fmt yuv420p",
        "-movflags +faststart",
        "-y",
      ])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(targetPath);
  });
}

async function downloadYoutubeVideo(
  videoUrl: string,
  outputPath: string
): Promise<void> {
  const pythonBin = process.env.YT_DLP_PYTHON_BIN ?? "python3";
  const outputTemplate = outputPath.replace(/\.mp4$/i, ".%(ext)s");
  let lastError: unknown;
  for (const playerClient of YOUTUBE_PLAYER_CLIENTS) {
    try {
      await execFile(
        pythonBin,
        [
          "-m",
          "yt_dlp",
          "--no-playlist",
          "--quiet",
          "--no-warnings",
          "--extractor-args",
          `youtube:player_client=${playerClient}`,
          "--merge-output-format",
          "mp4",
          "-f",
          "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
          "-o",
          outputTemplate,
          videoUrl,
        ],
        {
          maxBuffer: 20 * 1024 * 1024,
        }
      );
      return;
    } catch (error) {
      lastError = error;
      const stderr = error && typeof error === "object" ? String((error as { stderr?: unknown }).stderr ?? "") : "";
      const stdout = error && typeof error === "object" ? String((error as { stdout?: unknown }).stdout ?? "") : "";
      const message = `${stderr}\n${stdout}\n${error instanceof Error ? error.message : String(error)}`;
      if (!/403|HTTP Error 403|Sign in to confirm|This video is not available/i.test(message)) {
        throw error;
      }
      await fs.unlink(outputPath).catch(() => undefined);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("YouTube preview download failed after all client fallbacks.");
}

async function probeDurationSeconds(filePath: string): Promise<number | undefined> {
  return await new Promise<number | undefined>((resolve) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        resolve(undefined);
        return;
      }
      resolve(metadata.format.duration ?? undefined);
    });
  });
}

function pickPreviewStart(durationSec: number | undefined, previewSec: number): number {
  if (!durationSec || !Number.isFinite(durationSec) || durationSec <= previewSec + 2) {
    return 0;
  }

  const maxStart = Math.max(0, durationSec - previewSec);
  const target =
    durationSec <= 30
      ? 2
      : durationSec <= 90
        ? durationSec * 0.18
        : durationSec <= 300
          ? durationSec * 0.28
          : durationSec * 0.35;

  return Math.min(maxStart, Math.max(2, Math.round(target)));
}

function extractYouTubeInitialData(html: string): unknown | null {
  const marker = "var ytInitialData = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const tail = html.slice(start + marker.length);
  const end = tail.indexOf(";</script>");
  if (end === -1) return null;
  const jsonText = tail.slice(0, end).trim();
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }
}

function collectVideoLikeEntries(
  node: unknown,
  visit: (entry: Record<string, unknown>) => void
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectVideoLikeEntries(item, visit));
    return;
  }

  const record = node as Record<string, unknown>;
  if (record.videoId || record.reelWatchEndpoint || record.shortsLockupViewModel) {
    visit(record);
  }
  Object.values(record).forEach((value) => collectVideoLikeEntries(value, visit));
}

function firstText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.simpleText === "string") return record.simpleText;
  if (Array.isArray(record.runs)) {
    return record.runs
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).text : ""))
      .filter(Boolean)
      .join("");
  }
  return undefined;
}

function parseYouTubeDuration(value?: string): number | undefined {
  if (!value) return undefined;
  const parts = value.split(":").map((item) => Number(item));
  if (parts.some((item) => Number.isNaN(item))) return undefined;
  return parts.reduce((acc, item) => acc * 60 + item, 0);
}

async function searchYouTubeVideoCandidates(
  query: string,
  count: number
): Promise<VideoCandidateSearchResult[]> {
  const pythonBin = process.env.YT_DLP_PYTHON_BIN ?? "python3";
  const raw = await execFile(
    pythonBin,
    [
      "-m",
      "yt_dlp",
      "--flat-playlist",
      "--dump-json",
      "--no-playlist",
      `ytsearch${count}:${query}`,
    ],
    {
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  const seen = new Set<string>();
  const items: VideoCandidateSearchResult[] = [];
  const entries = raw.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of entries) {
    if (items.length >= count) break;
    try {
      const data = JSON.parse(line) as {
        id?: string;
        title?: string;
        description?: string | null;
        duration?: number;
        url?: string;
        webpage_url?: string;
        thumbnails?: Array<{ url?: string }>;
        uploader?: string;
        uploader_id?: string;
        channel?: string;
        channel_url?: string;
      };
      const videoId = data.id?.trim();
      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);
      const watchUrl = data.webpage_url ?? data.url ?? `https://www.youtube.com/watch?v=${videoId}`;
      const thumbnailUrl =
        data.thumbnails?.[data.thumbnails.length - 1]?.url ??
        data.thumbnails?.[0]?.url ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      items.push({
        id: `youtube-${videoId}`,
        media_type: "video",
        media_url: watchUrl,
        source_provider: "youtube",
        source_url: watchUrl,
        source_query: query,
        score: Math.max(1, 100 - items.length * 4),
        match_score: 0,
        match_passed: true,
        match_reasons: ["YouTube 搜索候选"],
        title: typeof data.title === "string" ? data.title : undefined,
        description: typeof data.description === "string" ? data.description : undefined,
        page_url: watchUrl,
        page_snippet: typeof data.description === "string" ? data.description : undefined,
        preview_image_url: thumbnailUrl,
        duration_sec: typeof data.duration === "number" ? data.duration : parseYouTubeDuration(undefined),
        source_author: data.uploader ?? data.channel ?? undefined,
      });
    } catch {
      continue;
    }
  }

  return items;
}

function makeSearchPageCandidate(
  provider: "douyin" | "xiaohongshu",
  query: string,
  title: string
): VideoCandidateSearchResult {
  const url =
    provider === "douyin"
      ? `https://www.douyin.com/search/${encodeURIComponent(query)}`
      : `https://www.xiaohongshu.com/search_result/?keyword=${encodeURIComponent(query)}`;
  return {
    id: `${provider}-${Buffer.from(url).toString("hex").slice(0, 16)}`,
    media_type: "page",
    media_url: url,
    source_provider: provider,
    source_url: url,
    source_query: query,
    score: 30,
    match_score: 18,
    match_passed: false,
    match_reasons: ["平台搜索入口", "仅作检索入口，不代表内容直接匹配"],
    title,
    description:
      provider === "douyin"
        ? "抖音搜索入口页，部分内容可能需要登录。"
        : "小红书搜索入口页，部分内容可能需要登录。",
    page_url: url,
  };
}

async function searchPageCandidates(
  query: string,
  count: number,
  aspectRatio: "portrait" | "landscape"
): Promise<VideoCandidateSearchResult[]> {
  const scene = buildSyntheticScene(query);
  const plan = buildSceneSearchPlan(scene, aspectRatio);
  const previewDir = await ensurePreviewDir();
  const youtube = await searchYouTubeVideoCandidates(query, Math.max(1, count - 2));
  const youtubeResults = shouldDownloadYoutubePreview()
    ? await mapWithConcurrency(youtube.slice(0, Math.min(2, youtube.length)), 1, async (candidate) => {
        const videoId = candidate.media_url.split("v=").pop()?.split("&")[0];
        if (!videoId) return null;
        const fileStem = `youtube-${candidate.id}`;
        const fullPath = path.join(previewDir, `${fileStem}-full.mp4`);
        const previewPath = path.join(previewDir, `${fileStem}-preview.mp4`);
        try {
          await downloadYoutubeVideo(candidate.media_url, fullPath);
          const mediaDuration = await probeDurationSeconds(fullPath);
          const startSeconds = pickPreviewStart(
            mediaDuration ?? candidate.duration_sec,
            PREVIEW_SECONDS
          );
          await createPreviewClip(fullPath, previewPath, PREVIEW_SECONDS, startSeconds);
          await fs.unlink(fullPath).catch(() => undefined);
          const matchEvaluation = evaluateSearchCandidate(
            {
              mediaType: "video",
              sourceProvider: "youtube",
              sourceQuery: query,
              title: candidate.title,
              description: candidate.description,
              durationSec: candidate.duration_sec,
            },
            plan,
            scene
          );
          return {
            ...candidate,
            preview_path: previewPath,
            match_score: matchEvaluation.matchScore,
            match_passed: matchEvaluation.matchPassed,
            match_reasons: matchEvaluation.matchReasons,
          };
        } catch {
          await fs.unlink(fullPath).catch(() => undefined);
          await fs.unlink(previewPath).catch(() => undefined);
          const matchEvaluation = evaluateSearchCandidate(
            {
              mediaType: "video",
              sourceProvider: "youtube",
              sourceQuery: query,
              title: candidate.title,
              description: candidate.description,
              durationSec: candidate.duration_sec,
            },
            plan,
            scene
          );
          return {
            ...candidate,
            page_snippet:
              candidate.page_snippet ??
              "YouTube 视频候选，预览下载失败，点击可打开原始页面。",
            match_score: matchEvaluation.matchScore,
            match_passed: matchEvaluation.matchPassed,
            match_reasons: matchEvaluation.matchReasons,
          };
        }
      })
    : youtube.map((candidate) => {
        const matchEvaluation = evaluateSearchCandidate(
          {
            mediaType: "video",
            sourceProvider: "youtube",
            sourceQuery: query,
            title: candidate.title,
            description: candidate.description,
            durationSec: candidate.duration_sec,
          },
          plan,
          scene
        );
        return {
          ...candidate,
          match_score: matchEvaluation.matchScore,
          match_passed: matchEvaluation.matchPassed,
          match_reasons: matchEvaluation.matchReasons,
        };
      });

  const pages = [
    ...(youtubeResults.filter(Boolean) as VideoCandidateSearchResult[]),
  ];
  return pages.slice(0, count);
}

export async function searchVideoCandidates(
  input: VideoCandidateSearchInput
): Promise<VideoCandidateSearchResult[]> {
  const query = input.query.trim();
  const count = clampCount(input.count);
  const aspectRatio = normalizeAspectRatio(input.aspect_ratio);
  const scene = buildSyntheticScene(query);
  const previewDir = await ensurePreviewDir();
  let ranked: Awaited<ReturnType<typeof searchRankedCandidates>>;
  try {
    ranked = await searchRankedCandidates(scene, "stock", count * 3, aspectRatio);
  } catch {
    ranked = [];
  }
  const previewResults = ranked.length
    ? await mapWithConcurrency(
        ranked.filter((candidate) => candidate.media_type === "video").slice(0, count),
        2,
        async (candidate) => {
          const fileStem = `${candidate.source_provider}-${candidate.id}`;
          const fullPath = path.join(previewDir, `${fileStem}-full.mp4`);
          const previewPath = path.join(previewDir, `${fileStem}-preview.mp4`);
          try {
            const media = await materializeCandidate(candidate);
            await fs.writeFile(fullPath, media.buffer);
            const mediaDuration = await probeDurationSeconds(fullPath);
            const startSeconds = pickPreviewStart(
              mediaDuration ?? candidate.duration_sec,
              PREVIEW_SECONDS
            );
            await createPreviewClip(fullPath, previewPath, PREVIEW_SECONDS, startSeconds);
            await fs.unlink(fullPath).catch(() => undefined);
            return {
              id: candidate.id,
              media_type: "video" as const,
              media_url: candidate.media_url,
              preview_path: previewPath,
              source_provider: candidate.source_provider,
              source_url: candidate.source_url,
              source_author: candidate.source_author,
              source_query: candidate.source_query,
              score: candidate.score,
              match_score: candidate.match_score,
              match_passed: candidate.match_passed,
              match_reasons: candidate.match_reasons,
              scene_category: candidate.scene_category,
              duration_sec: candidate.duration_sec,
              title: candidate.title,
              description: candidate.description,
            };
          } catch {
            return null;
          }
        }
      )
    : [];

  const pageResults = await searchPageCandidates(query, count, aspectRatio);

  const providerPriority = (provider: string, mediaType: string): number => {
    if (provider === "youtube" && mediaType === "video") return 0;
    if (provider === "bilibili" && mediaType === "video") return 1;
    if (mediaType === "video") return 2;
    return 3;
  };

  const combined = [...previewResults.filter(Boolean), ...pageResults];
  if (!combined.length) {
    return pageResults;
  }

  return combined
    .sort((left, right) => {
      const leftPass = left.match_passed ? 1 : 0;
      const rightPass = right.match_passed ? 1 : 0;
      if (leftPass !== rightPass) return rightPass - leftPass;
      if ((left.match_score ?? 0) !== (right.match_score ?? 0)) {
        return (right.match_score ?? 0) - (left.match_score ?? 0);
      }
      const leftPriority = providerPriority(left.source_provider, left.media_type);
      const rightPriority = providerPriority(right.source_provider, right.media_type);
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      if (left.media_type !== right.media_type) {
        return left.media_type === "video" ? -1 : 1;
      }
      return right.score - left.score;
    })
    .slice(0, count * 2) as VideoCandidateSearchResult[];
}
