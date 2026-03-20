import { promises as fs } from "fs";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import sharp from "sharp";
import type { ScriptScene } from "../../utils/json";
import { getImageConfig } from "../../config/env";
import { getAspectDimensions, normalizeAspectRatio } from "../../utils/aspectRatio";
import { mapWithConcurrency } from "../../utils/limit";
import { searchVideoCandidates } from "../search/videoCandidates.service";
import {
  generateImage,
  ImageProviderError,
  materializeCandidate,
  searchRankedCandidates,
  type RankedSceneCandidate,
} from "./imageProviders";
import type {
  VisualCandidate,
  VisualGenerateResponse,
  VisualSceneResult,
} from "./visual.types";

const STOCK_SEARCH_PROVIDERS = new Set([
  "pexels",
  "pixabay",
  "wikimedia",
  "openverse",
  "loc",
  "smithsonian",
  "europeana",
  "internet_archive",
  "baidu_image",
  "so_image",
  "stock",
]);

type VisualGenerateInput = {
  scenes: ScriptScene[];
  selections?: Array<{
    scene_id: number;
    candidate_id: string;
  }>;
  aspect_ratio?: "portrait" | "landscape";
};

const IMAGE_DIR = "images";
const SHOT_GUIDANCE = [
  "远景 establishing shot",
  "中景 medium shot",
  "近景 close-up shot",
  "特写 detail close-up",
  "低机位 medium close shot",
  "俯拍 wide shot",
];
const CANDIDATE_PREVIEW_SECONDS = 6;
const CANDIDATE_PREVIEW_LIMIT = 2;

async function ensureImageDir(): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? "";
  const resolvedBase = baseDir || path.resolve(process.cwd(), "storage");
  const imageDir = path.join(resolvedBase, IMAGE_DIR);
  await fs.mkdir(imageDir, { recursive: true });
  return imageDir;
}

async function ensureCandidatePreviewDir(): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? "";
  const resolvedBase = baseDir || path.resolve(process.cwd(), "storage");
  const previewDir = path.join(resolvedBase, "candidate-previews");
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

async function normalizeImage(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function bufferToDataUrl(buffer: Buffer, mediaType: "image" | "video", ext: string): string {
  const mime =
    mediaType === "video"
      ? ext.toLowerCase() === "webm"
        ? "video/webm"
        : "video/mp4"
      : ext.toLowerCase() === "png"
        ? "image/png"
        : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
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

function sanitizePrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[#@][^\s]+/g, "")
    .replace(/[“”"']/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const banned = [
    "血腥",
    "暴力",
    "裸露",
    "色情",
    "枪",
    "爆炸",
    "赌博",
    "毒品",
    "政治",
    "恐怖",
    "仇恨",
  ];
  let filtered = cleaned;
  banned.forEach((word) => {
    filtered = filtered.replace(new RegExp(word, "g"), "");
  });
  const safeSuffix = " 画面健康积极，纯净背景，无敏感内容，无人物特写。";
  return `${filtered.slice(0, 200)}${safeSuffix}`.trim();
}

function enhanceImagePrompt(prompt: string, sceneId: number): string {
  const shot = SHOT_GUIDANCE[(Math.max(1, sceneId) - 1) % SHOT_GUIDANCE.length];
  return [
    prompt.trim(),
    `镜头类型：${shot}。`,
    "写实电影摄影，主体明确，构图稳定，光影自然，细节清晰。",
    "人物 anatomy 正常，五官自然，手指完整，四肢不扭曲，不重复人物。",
    "禁止可读文字、禁止 logo、禁止水印、禁止球衣乱码、禁止海报字样。",
    "禁止夸张畸变、禁止漂浮物体、禁止错误透视、禁止模糊主体。",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

function buildStockSearchQuery(scene: ScriptScene): string {
  if (scene.stock_query?.trim()) {
    return scene.stock_query.trim().slice(0, 80);
  }

  return [scene.narration_text, scene.image_prompt]
    .join(" ")
    .replace(/[^A-Za-z0-9\u4e00-\u9fff\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function isNoRelevantMediaError(error: unknown): boolean {
  return (
    error instanceof ImageProviderError &&
    error.code === "NoResult" &&
    /no relevant media|no ranked media/i.test(error.message)
  );
}

async function materializePreviewCandidate(candidate: VisualCandidate): Promise<Awaited<ReturnType<typeof generateImage>>> {
  if (candidate.preview_path) {
    const buffer = await fs.readFile(candidate.preview_path);
    return {
      buffer,
      ext: path.extname(candidate.preview_path).replace(/^\./, "") || "mp4",
      mediaType: candidate.media_type,
      sourceProvider: candidate.source_provider,
      sourceUrl: candidate.source_url,
      sourceAuthor: candidate.source_author,
      sourceQuery: candidate.source_query,
      selectionScore: candidate.score,
    };
  }

  if (candidate.preview_image_url) {
    const response = await fetch(candidate.preview_image_url);
    if (!response.ok) {
      throw new Error(`Failed to download preview image: ${response.status}`);
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      ext: "jpg",
      mediaType: "image",
      sourceProvider: candidate.source_provider,
      sourceUrl: candidate.source_url,
      sourceAuthor: candidate.source_author,
      sourceQuery: candidate.source_query,
      selectionScore: candidate.score,
    };
  }

  throw new Error("Selected candidate has no local preview to materialize.");
}

async function buildSearchDrivenCandidates(
  scene: ScriptScene,
  aspectRatio: "portrait" | "landscape"
): Promise<VisualCandidate[]> {
  const results = await searchVideoCandidates({
    query: buildStockSearchQuery(scene) || scene.image_prompt,
    count: 6,
    aspect_ratio: aspectRatio,
    preview_mode: "thumbnail",
  });

  return results
    .filter(
      (candidate) =>
        candidate.media_type === "video" &&
        ((candidate.match_passed ?? false) || (candidate.match_score ?? 0) >= 55)
    )
    .map((candidate) => ({
      id: candidate.id,
      media_type: candidate.media_type,
      media_url: candidate.media_url,
      preview_path: candidate.preview_path,
      preview_image_url: candidate.preview_image_url,
      source_provider: candidate.source_provider,
      source_url: candidate.source_url,
      source_author: candidate.source_author,
      source_query: candidate.source_query,
      score: candidate.score,
      title: candidate.title,
      description: candidate.description ?? candidate.page_snippet,
      match_score: candidate.match_score,
      match_passed: candidate.match_passed,
      match_reasons: candidate.match_reasons,
    }));
}

async function createVideoCandidatePreview(
  candidate: RankedSceneCandidate,
  previewDir: string
): Promise<string | undefined> {
  if (candidate.media_type !== "video") return undefined;

  const fileStem = `${candidate.source_provider}-${candidate.id}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const fullPath = path.join(previewDir, `${fileStem}-full.mp4`);
  const previewPath = path.join(previewDir, `${fileStem}-preview.mp4`);

  try {
    const media = await materializeCandidate(candidate);
    await fs.writeFile(fullPath, media.buffer);
    const mediaDuration = await probeDurationSeconds(fullPath);
    const startSeconds = pickPreviewStart(
      mediaDuration ?? candidate.duration_sec,
      CANDIDATE_PREVIEW_SECONDS
    );
    await createPreviewClip(fullPath, previewPath, CANDIDATE_PREVIEW_SECONDS, startSeconds);
    await fs.unlink(fullPath).catch(() => undefined);
    return previewPath;
  } catch {
    await fs.unlink(fullPath).catch(() => undefined);
    await fs.unlink(previewPath).catch(() => undefined);
    return undefined;
  }
}

function hasQwenImageConfig(config: ReturnType<typeof getImageConfig>): boolean {
  return Boolean(config.qwenApiKey && config.qwenApiBase && config.qwenApiPath);
}

function hasOpenAIImageConfig(config: ReturnType<typeof getImageConfig>): boolean {
  return Boolean(config.openaiApiKey && config.openaiBaseUrl);
}

function hasCogviewImageConfig(config: ReturnType<typeof getImageConfig>): boolean {
  return Boolean(config.cogviewApiKey && config.cogviewApiBase && config.cogviewApiPath);
}

async function createLocalFallbackImage(
  prompt: string,
  sceneId: number,
  aspectRatio: "portrait" | "landscape",
  width: number,
  height: number
): Promise<Awaited<ReturnType<typeof generateImage>>> {
  const safePrompt = sanitizePrompt(prompt).slice(0, 120);
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.1)}" width="${Math.round(width * 0.84)}" height="${Math.round(height * 0.8)}" rx="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
      <text x="50%" y="42%" text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="${Math.max(24, Math.round(Math.min(width, height) * 0.045))}" font-weight="700">
        <tspan x="50%" dy="0">${escapeSvgText(`Scene ${sceneId}`)}</tspan>
        <tspan x="50%" dy="${Math.max(28, Math.round(Math.min(width, height) * 0.06))}">${escapeSvgText(aspectRatio === "portrait" ? "Portrait fallback" : "Landscape fallback")}</tspan>
      </text>
      <text x="50%" y="${Math.round(height * 0.72)}" text-anchor="middle" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="${Math.max(16, Math.round(Math.min(width, height) * 0.022))}">
        ${escapeSvgText(safePrompt)}
      </text>
    </svg>
  `.trim();

  const buffer = await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
  return {
    buffer,
    ext: "jpg",
    mediaType: "image",
    sceneCategory: "general",
    sourceProvider: "fallback",
    sourceQuery: prompt,
    selectionScore: 0,
  };
}

async function generateConfiguredFallbackImage(
  prompt: string,
  sceneId: number,
  aspectRatio: "portrait" | "landscape",
  config: ReturnType<typeof getImageConfig>
): Promise<Awaited<ReturnType<typeof generateImage>>> {
  const enhancedPrompt = enhanceImagePrompt(prompt, sceneId);

  const { width, height } = getAspectDimensions(
    aspectRatio,
    config.imageWidth,
    config.imageHeight
  );
  const openaiInput = {
    prompt: sanitizePrompt(enhancedPrompt),
    aspectRatio,
  };
  const cogviewInput = {
    prompt: sanitizePrompt(enhancedPrompt),
    aspectRatio,
  };

  if (hasQwenImageConfig(config)) {
    try {
      return await generateSceneImage(
        prompt,
        sceneId,
        hasCogviewImageConfig(config),
        hasOpenAIImageConfig(config),
        aspectRatio
      );
    } catch {
      // Fall through to direct fallback providers below.
    }
  }

  if (hasOpenAIImageConfig(config)) {
    try {
      return await generateImageWithRetry(openaiInput, "openai");
    } catch {
      // Continue to next fallback.
    }
  }

  if (hasCogviewImageConfig(config)) {
    try {
      return await generateImageWithRetry(cogviewInput, "cogview");
    } catch {
      // Continue to local placeholder.
    }
  }

  return createLocalFallbackImage(prompt, sceneId, aspectRatio, width, height);
}

function isQwenRetriableError(error: unknown): boolean {
  if (!(error instanceof ImageProviderError) || error.provider !== "qwen") {
    return false;
  }
  return error.code === "TaskTimeout" || error.code === "Throttling" || error.code === "RateLimitExceeded";
}

async function tryGenerate(
  input: Parameters<typeof generateImage>[0],
  provider?:
    | "qwen"
    | "cogview"
    | "openai"
    | "pexels"
    | "pixabay"
    | "wikimedia"
    | "openverse"
    | "loc"
    | "smithsonian"
    | "europeana"
    | "internet_archive"
    | "baidu_image"
    | "so_image"
    | "stock"
): Promise<Awaited<ReturnType<typeof generateImage>>> {
  return generateImage(input, provider);
}

async function generateImageWithRetry(
  input: Parameters<typeof generateImage>[0],
  provider?:
    | "qwen"
    | "cogview"
    | "openai"
    | "pexels"
    | "pixabay"
    | "wikimedia"
    | "openverse"
    | "loc"
    | "smithsonian"
    | "europeana"
    | "internet_archive"
    | "baidu_image"
    | "so_image"
    | "stock"
): Promise<Awaited<ReturnType<typeof generateImage>>> {
  const wrapPrompt = (prompt: string) =>
    typeof input === "string"
      ? prompt
      : {
          ...input,
          prompt,
        };
  try {
    return await tryGenerate(input, provider);
  } catch (error) {
    if (error instanceof ImageProviderError && error.code === "DataInspectionFailed") {
      const prompt = typeof input === "string" ? input : input.prompt;
      const safePrompt = sanitizePrompt(prompt);
      return await tryGenerate(wrapPrompt(safePrompt), provider);
    }
    if (isQwenRetriableError(error)) {
      const prompt = typeof input === "string" ? input : input.prompt;
      const simplifiedPrompt = sanitizePrompt(prompt).slice(0, 120);
      return await tryGenerate(wrapPrompt(simplifiedPrompt), provider);
    }
    throw error;
  }
}

async function generateSceneImage(
  prompt: string,
  sceneId: number,
  canFallbackToCogview: boolean,
  canFallbackToOpenAI: boolean,
  aspectRatio: "portrait" | "landscape"
): Promise<Awaited<ReturnType<typeof generateImage>>> {
  const enhancedPrompt = enhanceImagePrompt(prompt, sceneId);
  try {
    return await generateImageWithRetry(
      { prompt: enhancedPrompt, aspectRatio },
      "qwen"
    );
  } catch (error) {
    if (
      canFallbackToOpenAI &&
      error instanceof ImageProviderError &&
      error.provider === "qwen" &&
      (error.code === "TaskTimeout" ||
        error.code === "DataInspectionFailed" ||
        error.code === "Throttling" ||
        error.code === "RateLimitExceeded")
    ) {
      return await generateImageWithRetry(
        { prompt: sanitizePrompt(enhancedPrompt), aspectRatio },
        "openai"
      );
    }
    if (
      canFallbackToCogview &&
      error instanceof ImageProviderError &&
      error.provider === "qwen" &&
      (error.code === "TaskTimeout" ||
        error.code === "DataInspectionFailed" ||
        error.code === "Throttling" ||
        error.code === "RateLimitExceeded")
    ) {
      return await generateImageWithRetry(
        { prompt: sanitizePrompt(enhancedPrompt), aspectRatio },
        "cogview"
      );
    }
    throw error;
  }
}

export async function generateVisuals(
  input: VisualGenerateInput
): Promise<VisualGenerateResponse> {
  const config = getImageConfig();
  const imageDir = await ensureImageDir();
  const aspectRatio = normalizeAspectRatio(input.aspect_ratio);
  const { width: imageWidth, height: imageHeight } = getAspectDimensions(
    aspectRatio,
    config.imageWidth,
    config.imageHeight
  );
  const selectionMap = new Map(
    (input.selections ?? []).map((item) => [item.scene_id, item.candidate_id])
  );
  const effectiveConcurrency =
    config.imageProvider === "qwen"
      ? 1
      : Math.max(1, config.imageConcurrency);

  const results = await mapWithConcurrency(
    input.scenes,
    effectiveConcurrency,
    async (scene: ScriptScene) => {
      let imageResult: Awaited<ReturnType<typeof generateImage>>;
      let rankedCandidates: RankedSceneCandidate[] = [];
      let searchDrivenCandidates: VisualCandidate[] = [];
      const selectedCandidateId = selectionMap.get(scene.scene_id);
      if (config.imageProvider === "qwen") {
        imageResult = await generateSceneImage(
          scene.image_prompt,
          scene.scene_id,
          Boolean(config.cogviewApiKey),
          Boolean(config.openaiApiKey),
          aspectRatio
        );
      } else if (config.imageProvider === "cogview") {
        imageResult = await generateImageWithRetry(
          {
            prompt: enhanceImagePrompt(scene.image_prompt, scene.scene_id),
            aspectRatio,
          },
          "cogview"
        );
      } else if (config.imageProvider === "openai") {
        imageResult = await generateImageWithRetry(
          {
            prompt: enhanceImagePrompt(scene.image_prompt, scene.scene_id),
            aspectRatio,
          },
          "openai"
        );
      } else if (STOCK_SEARCH_PROVIDERS.has(config.imageProvider)) {
        try {
          searchDrivenCandidates = await buildSearchDrivenCandidates(scene, aspectRatio);
        } catch {
          searchDrivenCandidates = [];
        }

        const prioritizedSearchCandidates = selectedCandidateId
          ? [
              ...searchDrivenCandidates.filter((item) => item.id === selectedCandidateId),
              ...searchDrivenCandidates.filter((item) => item.id !== selectedCandidateId),
            ]
          : searchDrivenCandidates;

        if (prioritizedSearchCandidates.length) {
          try {
            imageResult = await materializePreviewCandidate(prioritizedSearchCandidates[0]);
          } catch {
            imageResult = await generateConfiguredFallbackImage(
              buildStockSearchQuery(scene) || scene.image_prompt,
              scene.scene_id,
              aspectRatio,
              config
            );
          }
        }

        rankedCandidates = [];

        if (!searchDrivenCandidates.length) {
          imageResult = await generateConfiguredFallbackImage(
            buildStockSearchQuery(scene) || scene.image_prompt,
            scene.scene_id,
            aspectRatio,
            config
          );
        }
      } else {
        imageResult = await generateImageWithRetry(
          {
            prompt: enhanceImagePrompt(scene.image_prompt, scene.scene_id),
            aspectRatio,
          }
        );
      }
      let imagePath: string | undefined;
      let videoPath: string | undefined;
      if (imageResult.mediaType === "video") {
        const filename = `scene-${scene.scene_id}-${Date.now()}.${imageResult.ext || "mp4"}`;
        videoPath = path.join(imageDir, filename);
        await fs.writeFile(videoPath, imageResult.buffer);
      } else {
        const normalized = await normalizeImage(
          imageResult.buffer,
          imageWidth,
          imageHeight
        );
        const filename = `scene-${scene.scene_id}-${Date.now()}.jpg`;
        imagePath = path.join(imageDir, filename);
        await fs.writeFile(imagePath, normalized);
      }

      const candidates: VisualCandidate[] = searchDrivenCandidates.length
        ? searchDrivenCandidates
        : rankedCandidates.map((candidate) => ({
            id: candidate.id,
            media_type: candidate.media_type,
            media_url: candidate.media_url,
            preview_path: undefined,
            source_provider: candidate.source_provider,
            source_url: candidate.source_url,
            source_author: candidate.source_author,
            source_query: candidate.source_query,
            score: candidate.score,
            title: candidate.title,
            description: candidate.description,
            match_score: candidate.match_score,
            match_passed: candidate.match_passed,
            match_reasons: candidate.match_reasons,
          }));

      if (!searchDrivenCandidates.length) {
        const previewDir = await ensureCandidatePreviewDir();
        const previewTargets = rankedCandidates
          .filter((candidate) => candidate.media_type === "video")
          .slice(0, CANDIDATE_PREVIEW_LIMIT);
        const previewMap = new Map<string, string | undefined>();
        await Promise.all(
          previewTargets.map(async (candidate) => {
            const previewPath = await createVideoCandidatePreview(candidate, previewDir);
            previewMap.set(candidate.id, previewPath);
          })
        );

        for (const candidate of candidates) {
          const previewPath = previewMap.get(candidate.id);
          if (previewPath) {
            candidate.preview_path = previewPath;
          }
        }
      }

      if (!candidates.length) {
        candidates.push({
          id: `fallback-${scene.scene_id}`,
          media_type: imageResult.mediaType ?? "image",
          media_url: bufferToDataUrl(
            imageResult.buffer,
            imageResult.mediaType ?? "image",
            imageResult.ext || "jpg"
          ),
          source_provider: imageResult.sourceProvider ?? "fallback",
          source_url: imageResult.sourceUrl,
          source_author: imageResult.sourceAuthor,
          source_query: imageResult.sourceQuery,
          score: imageResult.selectionScore ?? 0,
          title: "本地兜底候选",
          description: "外部素材未命中时使用的本地兜底候选，可继续进入后续流程。",
          match_score: 0,
          match_passed: true,
          match_reasons: ["外部素材未命中", "本地兜底候选"],
        });
      }

      const resolvedSelectedCandidateId =
        selectedCandidateId ?? candidates[0]?.id;

      const result: VisualSceneResult = {
        scene_id: scene.scene_id,
        image_prompt: scene.image_prompt,
        media_type: imageResult.mediaType ?? "image",
        image_path: imagePath,
        video_path: videoPath,
        width: imageWidth,
        height: imageHeight,
        selected_candidate_id: resolvedSelectedCandidateId,
        candidates,
        scene_category: imageResult.sceneCategory,
        source_provider: imageResult.sourceProvider,
        source_url: imageResult.sourceUrl,
        source_author: imageResult.sourceAuthor,
        source_query: imageResult.sourceQuery,
        selection_score: imageResult.selectionScore,
      };
      return result;
    }
  );

  return { scenes: results };
}
