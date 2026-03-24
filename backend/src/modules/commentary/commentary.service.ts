import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { env, getScriptConfig } from "../../config/env";
import { buildPublicMediaUrl } from "../../utils/media";
import { mapWithConcurrency } from "../../utils/limit";
import { recognizeWithDashScope } from "../audio/dashscopeAsr";
import { recognizeWithFasterWhisper } from "../audio/fasterWhisperAsr";
import { chatWithOllama } from "../../services/ollamaClient";
import { chatWithOpenAI } from "../../services/openaiClient";
import { chatWithQwen } from "../../services/qwenClient";
import { createProject, getProject, updateProject } from "./commentary.store";
import type { CommentaryProject, CommentarySegment } from "./commentary.types";

type CommentaryProvider = "qwen" | "openai" | "ollama";

function getProjectsMediaDir(projectId: string): string {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
  return path.join(baseDir, "commentary-assets", projectId);
}

async function ensureProjectDir(projectId: string): Promise<string> {
  const dir = getProjectsMediaDir(projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function ensureIncomingUploadsDir(): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
  const dir = path.join(baseDir, "commentary-assets", "incoming");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function probeDurationMs(filePath: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Math.round((metadata.format.duration ?? 0) * 1000));
    });
  });
}

async function splitVideoClip(sourcePath: string, outputPath: string, startSec: number, durationSec: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(sourcePath)
      .seekInput(Math.max(0, startSec))
      .outputOptions(["-t", String(durationSec), "-c:v libx264", "-preset veryfast", "-crf 24", "-c:a aac", "-movflags +faststart", "-y"])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

async function extractSegmentAudioWav(sourcePath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(sourcePath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .format("wav")
      .outputOptions(["-y"])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

async function detectMeanVolumeDb(sourcePath: string): Promise<number | null> {
  return await new Promise<number | null>((resolve, reject) => {
    let stderr = "";
    ffmpeg(sourcePath)
      .noVideo()
      .audioFilters("volumedetect")
      .format("null")
      .output("-")
      .on("stderr", (line) => {
        stderr += `${line}\n`;
      })
      .on("end", () => {
        const match = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
        resolve(match ? Number(match[1]) : null);
      })
      .on("error", (err) => {
        const match = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/i);
        if (match) {
          resolve(Number(match[1]));
          return;
        }
        reject(err);
      })
      .run();
  });
}

function getProviderOrder(): CommentaryProvider[] {
  const preferred = getScriptConfig().scriptProvider;
  const providers: CommentaryProvider[] = [preferred];
  if (preferred !== "qwen" && env.qwenChatApiKey) providers.push("qwen");
  if (preferred !== "openai" && env.openaiApiKey) providers.push("openai");
  if (preferred !== "ollama" && env.ollamaBaseUrl) providers.push("ollama");
  return Array.from(new Set(providers));
}

async function chatWithProvider(provider: CommentaryProvider, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>): Promise<string> {
  if (provider === "openai") return chatWithOpenAI(messages, { maxTokens: 1800, temperature: 0.65 });
  if (provider === "ollama") return chatWithOllama(messages, { maxTokens: 1800, temperature: 0.65 });
  return chatWithQwen(messages, { maxTokens: 1800, temperature: 0.65 });
}

async function analyzeTextBlock(title: string, transcript: string): Promise<{ summary: string; commentary: string; highlight: string }> {
  const messages = [
    {
      role: "system" as const,
      content:
        "你是一名专业的影视解说编导。输出严格 JSON，格式为 {\"summary\":\"...\",\"commentary\":\"...\",\"highlight\":\"...\"}。summary 是对片段内容的简洁描述；commentary 是更像真人口播的解说文案，不能 AI 总结腔；highlight 是一句适合保留原声或重点剪辑的片段提示。",
    },
    {
      role: "user" as const,
      content: `标题: ${title}\n转录文本:\n${transcript.slice(0, 5000)}`,
    },
  ];

  let lastError: unknown;
  for (const provider of getProviderOrder()) {
    try {
      const raw = await chatWithProvider(provider, messages);
      const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {
        summary?: string;
        commentary?: string;
        highlight?: string;
      };
      return {
        summary: parsed.summary?.trim() || transcript.slice(0, 120),
        commentary: parsed.commentary?.trim() || transcript.slice(0, 220),
        highlight: parsed.highlight?.trim() || "建议人工判断是否保留原声",
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to analyze segment text.");
}

async function recognizeWithFallback(videoPath: string): Promise<{ text: string; meanVolumeDb: number | null }> {
  const tempAudioPath = path.join(
    path.dirname(videoPath),
    `${path.basename(videoPath, path.extname(videoPath))}-asr.wav`
  );
  await extractSegmentAudioWav(videoPath, tempAudioPath);
  const meanVolumeDb = await detectMeanVolumeDb(tempAudioPath);
  try {
    const result = await recognizeWithFasterWhisper(tempAudioPath);
    if (result.recognizedText.trim()) {
      await fs.rm(tempAudioPath, { force: true });
      return { text: result.recognizedText.trim(), meanVolumeDb };
    }
  } catch {}
  const result = await recognizeWithDashScope(tempAudioPath);
  await fs.rm(tempAudioPath, { force: true });
  return { text: result.recognizedText.trim(), meanVolumeDb };
}

export async function createCommentaryProjectFromLocalPath(input: { userId: string; title?: string; sourcePath: string; }): Promise<CommentaryProject> {
  const resolvedSource = path.resolve(input.sourcePath);
  const stat = await fs.stat(resolvedSource);
  if (!stat.isFile()) {
    throw new Error("sourcePath 必须是视频文件路径。");
  }
  const durationMs = await probeDurationMs(resolvedSource);
  const now = new Date().toISOString();
  const project: CommentaryProject = {
    id: randomUUID(),
    user_id: input.userId,
    title: input.title?.trim() || path.basename(resolvedSource, path.extname(resolvedSource)),
    source_path: resolvedSource,
    source_url: buildPublicMediaUrl(resolvedSource) ?? undefined,
    duration_ms: durationMs,
    status: "imported",
    segment_minutes: 5,
    segments: [],
    created_at: now,
    updated_at: now,
  };
  createProject(project);
  return project;
}

export async function createCommentaryProjectFromUploadedFile(input: {
  userId: string;
  title?: string;
  originalName: string;
  tempFilePath: string;
}): Promise<CommentaryProject> {
  const uploadsDir = await ensureIncomingUploadsDir();
  const ext = path.extname(input.originalName || input.tempFilePath) || ".mp4";
  const finalName = `${Date.now()}-${randomUUID()}${ext}`;
  const finalPath = path.join(uploadsDir, finalName);
  await fs.rename(input.tempFilePath, finalPath);
  return createCommentaryProjectFromLocalPath({
    userId: input.userId,
    title: input.title,
    sourcePath: finalPath,
  });
}

export async function segmentCommentaryProject(projectId: string, segmentMinutes = 5): Promise<CommentaryProject> {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found.");
  const safeSegmentMinutes = Math.max(1, Math.min(20, segmentMinutes));
  const segmentDurationMs = safeSegmentMinutes * 60 * 1000;
  const segmentCount = Math.max(1, Math.ceil(project.duration_ms / segmentDurationMs));
  const projectDir = await ensureProjectDir(project.id);
  const segmentsDir = path.join(projectDir, "segments");
  await fs.mkdir(segmentsDir, { recursive: true });

  const segments: CommentarySegment[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const startMs = index * segmentDurationMs;
    const endMs = Math.min(project.duration_ms, startMs + segmentDurationMs);
    const clipPath = path.join(segmentsDir, `segment-${String(index + 1).padStart(3, "0")}.mp4`);
    await splitVideoClip(project.source_path, clipPath, startMs / 1000, (endMs - startMs) / 1000);
    segments.push({
      id: randomUUID(),
      index: index + 1,
      title: `片段 ${index + 1}`,
      source_path: clipPath,
      source_url: buildPublicMediaUrl(clipPath) ?? undefined,
      start_ms: startMs,
      end_ms: endMs,
      duration_ms: endMs - startMs,
      keep_original_audio: true,
      original_audio_gain: 1,
      commentary_audio_gain: 1,
      status: "pending",
    });
  }

  const updated = updateProject(project.id, {
    status: "segmented",
    segment_minutes: safeSegmentMinutes,
    segments,
  });
  if (!updated) throw new Error("Failed to update project.");
  return updated;
}

export async function analyzeCommentaryProject(projectId: string, segmentIds?: string[]): Promise<CommentaryProject> {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found.");
  updateProject(project.id, { status: "analyzing" });
  const targetIds = new Set(segmentIds ?? project.segments.map((segment) => segment.id));
  const nextSegments = [...project.segments];

  await mapWithConcurrency(nextSegments, 2, async (segment, index) => {
    if (!targetIds.has(segment.id)) return;
    nextSegments[index] = { ...segment, status: "analyzing", error: undefined };
    try {
      const asr = await recognizeWithFallback(segment.source_path);
      if (!asr.text.trim()) {
        const hasAudibleSpeech = asr.meanVolumeDb !== null && asr.meanVolumeDb > -35;
        nextSegments[index] = {
          ...nextSegments[index],
          transcript_text: "",
          transcript_summary: hasAudibleSpeech
            ? "检测到片段存在明显音频，但当前转录未成功，请重试或人工处理。"
            : "片段音量极低或接近静音，暂时未提取到有效语音内容。",
          commentary_text: "",
          highlight_text: hasAudibleSpeech ? "音频存在但识别失败" : "静音或环境声片段",
          keep_original_audio: hasAudibleSpeech,
          status: hasAudibleSpeech ? "failed" : "ready",
          error: hasAudibleSpeech ? "ASR returned empty transcript for non-silent segment." : undefined,
        };
        return;
      }
      const analyzed = await analyzeTextBlock(`${project.title} ${segment.title}`, asr.text);
      nextSegments[index] = {
        ...nextSegments[index],
        transcript_text: asr.text,
        transcript_summary: analyzed.summary,
        commentary_text: analyzed.commentary,
        highlight_text: analyzed.highlight,
        suggested_clip_start_ms: segment.start_ms,
        suggested_clip_end_ms: segment.end_ms,
        keep_original_audio: /原声|对白|情绪|高潮/.test(analyzed.highlight),
        status: "ready",
      };
    } catch (error) {
      nextSegments[index] = {
        ...nextSegments[index],
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const updated = updateProject(project.id, {
    status: nextSegments.some((segment) => segment.status === "failed") ? "failed" : "ready",
    segments: nextSegments,
  });
  if (!updated) throw new Error("Failed to update project.");
  return updated;
}

export function getCommentaryProject(projectId: string): CommentaryProject {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found.");
  return project;
}

export function updateCommentarySegment(projectId: string, segmentId: string, patch: Partial<CommentarySegment>): CommentaryProject {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found.");
  const nextSegments = project.segments.map((segment) =>
    segment.id === segmentId
      ? {
          ...segment,
          ...patch,
        }
      : segment
  );
  const updated = updateProject(project.id, { segments: nextSegments });
  if (!updated) throw new Error("Failed to update project.");
  return updated;
}
