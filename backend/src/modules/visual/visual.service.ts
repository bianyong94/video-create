import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import type { ScriptScene } from "../../utils/json";
import { getImageConfig } from "../../config/env";
import { mapWithConcurrency } from "../../utils/limit";
import { generateImage, ImageProviderError } from "./imageProviders";
import type { VisualGenerateResponse, VisualSceneResult } from "./visual.types";

type VisualGenerateInput = {
  scenes: ScriptScene[];
};

const IMAGE_DIR = "images";

async function ensureImageDir(): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? "";
  const resolvedBase = baseDir || path.resolve(process.cwd(), "storage");
  const imageDir = path.join(resolvedBase, IMAGE_DIR);
  await fs.mkdir(imageDir, { recursive: true });
  return imageDir;
}

async function normalizeImage(buffer: Buffer): Promise<Buffer> {
  const config = getImageConfig();
  return sharp(buffer)
    .resize(config.imageWidth, config.imageHeight, { fit: "cover" })
    .jpeg({ quality: 92 })
    .toBuffer();
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

function isQwenRetriableError(error: unknown): boolean {
  if (!(error instanceof ImageProviderError) || error.provider !== "qwen") {
    return false;
  }
  return error.code === "TaskTimeout" || error.code === "Throttling" || error.code === "RateLimitExceeded";
}

async function tryGenerate(prompt: string, provider?: "qwen" | "cogview"): Promise<Buffer> {
  const raw = await generateImage(prompt, provider);
  return raw.buffer;
}

async function generateImageWithRetry(prompt: string, provider?: "qwen" | "cogview"): Promise<Buffer> {
  try {
    return await tryGenerate(prompt, provider);
  } catch (error) {
    if (error instanceof ImageProviderError && error.code === "DataInspectionFailed") {
      const safePrompt = sanitizePrompt(prompt);
      return await tryGenerate(safePrompt, provider);
    }
    if (isQwenRetriableError(error)) {
      const simplifiedPrompt = sanitizePrompt(prompt).slice(0, 120);
      return await tryGenerate(simplifiedPrompt, provider);
    }
    throw error;
  }
}

async function generateSceneImage(prompt: string, canFallbackToCogview: boolean): Promise<Buffer> {
  try {
    return await generateImageWithRetry(prompt, "qwen");
  } catch (error) {
    if (
      canFallbackToCogview &&
      error instanceof ImageProviderError &&
      error.provider === "qwen" &&
      (error.code === "TaskTimeout" ||
        error.code === "DataInspectionFailed" ||
        error.code === "Throttling" ||
        error.code === "RateLimitExceeded")
    ) {
      return await generateImageWithRetry(sanitizePrompt(prompt), "cogview");
    }
    throw error;
  }
}

export async function generateVisuals(
  input: VisualGenerateInput
): Promise<VisualGenerateResponse> {
  const config = getImageConfig();
  const imageDir = await ensureImageDir();
  const effectiveConcurrency =
    config.imageProvider === "qwen"
      ? 1
      : Math.max(1, config.imageConcurrency);

  const results = await mapWithConcurrency(
    input.scenes,
    effectiveConcurrency,
    async (scene: ScriptScene) => {
      let buffer: Buffer;
      if (config.imageProvider === "qwen" && config.cogviewApiKey) {
        buffer = await generateSceneImage(scene.image_prompt, true);
      } else if (config.imageProvider === "qwen") {
        buffer = await generateImageWithRetry(scene.image_prompt, "qwen");
      } else if (config.imageProvider === "cogview") {
        buffer = await generateImageWithRetry(scene.image_prompt, "cogview");
      } else {
        buffer = await generateImageWithRetry(scene.image_prompt);
      }
      const normalized = await normalizeImage(buffer);
      const filename = `scene-${scene.scene_id}-${Date.now()}.jpg`;
      const imagePath = path.join(imageDir, filename);
      await fs.writeFile(imagePath, normalized);

      const result: VisualSceneResult = {
        scene_id: scene.scene_id,
        image_prompt: scene.image_prompt,
        image_path: imagePath,
        width: config.imageWidth,
        height: config.imageHeight,
      };
      return result;
    }
  );

  return { scenes: results };
}
