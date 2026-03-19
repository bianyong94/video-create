import { randomUUID } from "crypto";
import { createJob, getJob, updateJob } from "./job.store";
import { generateScript } from "../script/script.service";
import { generateAudioAndTimestamps } from "../audio/audio.service";
import { generateVisuals } from "../visual/visual.service";
import { assembleVideo } from "../video/video.service";
import type { ScriptScene } from "../../utils/json";
import type { AudioSceneResult } from "../audio/audio.types";
import type { VisualSceneResult } from "../visual/visual.types";
import { deductCredits } from "../../services/credits.service";
import { buildPublicMediaUrl } from "../../utils/media";

export type OrchestratorInput = {
  topic?: string;
  sourceUrl?: string;
  sceneCount?: number;
  narrationDensity?: "short" | "medium" | "long";
  targetDurationMinutes?: number;
  aspectRatio?: "portrait" | "landscape";
  userId: string;
  voice?: string;
  bgmStyle?: string;
  bgmEnabled?: boolean;
  bgmPath?: string;
};

type MergedScene = {
  scene_id: number;
  narration_text: string;
  image_prompt: string;
  audio_path: string;
  duration_ms: number;
  timestamps: AudioSceneResult["timestamps"];
  image_path?: string;
  video_path?: string;
};

function mergeScenes(
  script: ScriptScene[],
  audio: AudioSceneResult[],
  visual: VisualSceneResult[]
): MergedScene[] {
  const audioMap = new Map(audio.map((item) => [item.scene_id, item]));
  const visualMap = new Map(visual.map((item) => [item.scene_id, item]));

  return script.map((scene) => {
    const audioItem = audioMap.get(scene.scene_id);
    const visualItem = visualMap.get(scene.scene_id);
    if (!audioItem || !visualItem) {
      throw new Error(`Missing audio or image for scene ${scene.scene_id}`);
    }
    if (!visualItem.image_path && !visualItem.video_path) {
      throw new Error(`Missing visual media for scene ${scene.scene_id}`);
    }
    return {
      scene_id: scene.scene_id,
      narration_text: scene.narration_text,
      image_prompt: scene.image_prompt,
      audio_path: audioItem.audio_path,
      duration_ms: audioItem.duration_ms,
      timestamps: audioItem.timestamps,
      image_path: visualItem.image_path,
      video_path: visualItem.video_path,
    };
  });
}

export function startPipeline(input: OrchestratorInput): { jobId: string } {
  const jobId = randomUUID();
  createJob(jobId, input);

  void runPipeline(jobId, input);
  return { jobId };
}

type PartialResult = {
  script?: { scenes: ScriptScene[] };
  audio?: { scenes: AudioSceneResult[] };
  visual?: { scenes: VisualSceneResult[] };
  video?: unknown;
};

type ResumeOptions = {
  startStage?: "script" | "audio" | "visual" | "video";
  partial?: PartialResult;
};

export function resumePipeline(
  previousJobId: string,
  inputOverride?: Partial<OrchestratorInput>
): { jobId: string } {
  const previous = getJob(previousJobId);
  if (!previous) {
    throw new Error("Job not found.");
  }
  if (previous.stage !== "failed") {
    throw new Error("Job is not in failed state.");
  }

  const input: OrchestratorInput = {
    userId: inputOverride?.userId ?? previous.userId,
    topic: inputOverride?.topic ?? previous.topic,
    sourceUrl: inputOverride?.sourceUrl ?? previous.sourceUrl,
    sceneCount: inputOverride?.sceneCount ?? previous.sceneCount,
    narrationDensity:
      inputOverride?.narrationDensity ?? previous.narrationDensity,
    targetDurationMinutes:
      inputOverride?.targetDurationMinutes ?? previous.targetDurationMinutes,
    aspectRatio: inputOverride?.aspectRatio ?? previous.aspectRatio,
    voice: inputOverride?.voice ?? previous.voice,
    bgmStyle: inputOverride?.bgmStyle ?? previous.bgmStyle,
    bgmEnabled: inputOverride?.bgmEnabled ?? previous.bgmEnabled,
    bgmPath: inputOverride?.bgmPath ?? previous.bgmPath,
  };

  const jobId = randomUUID();
  createJob(jobId, input);

  const failedStage = previous.failedStage ?? "script";

  void runPipeline(jobId, input, {
    startStage: failedStage,
    partial: (previous.result ?? {}) as PartialResult,
  });

  return { jobId };
}

export function startPipelineFromPartial(
  input: OrchestratorInput,
  startStage: "script" | "audio" | "visual" | "video",
  partial: PartialResult
): { jobId: string } {
  const jobId = randomUUID();
  createJob(jobId, input);
  void runPipeline(jobId, input, {
    startStage,
    partial,
  });
  return { jobId };
}

async function runPipeline(
  jobId: string,
  input: OrchestratorInput,
  options?: ResumeOptions
) {
  const partialResult: {
    script?: unknown;
    audio?: unknown;
    visual?: unknown;
    video?: unknown;
  } = {};

  let currentStage: "script" | "audio" | "visual" | "video" = "script";
  try {
    const startStage = options?.startStage ?? "script";
    let script = options?.partial?.script ?? null;
    let audio = options?.partial?.audio ?? null;
    let visual = options?.partial?.visual ?? null;

    if (startStage === "script") {
      currentStage = "script";
      updateJob(jobId, { stage: "script", progress: 20, message: "正在撰写脚本..." });
      script = await generateScript({
        topic: input.topic ?? "未命名主题",
        sourceUrl: input.sourceUrl,
        sceneCount: input.sceneCount,
        narrationDensity: input.narrationDensity,
        targetDurationMinutes: input.targetDurationMinutes,
        aspectRatio: input.aspectRatio,
      });
      partialResult.script = script;
      updateJob(jobId, { result: partialResult });
    } else if (script) {
      partialResult.script = script;
      updateJob(jobId, { result: partialResult });
    } else {
      throw new Error("Missing script result for resume.");
    }

    if (startStage === "script" || startStage === "audio") {
      currentStage = "audio";
      updateJob(jobId, { stage: "audio", progress: 40, message: "正在生成配音..." });
      audio = await generateAudioAndTimestamps({
        scenes: script.scenes,
        voice: input.voice,
      });
      partialResult.audio = audio;
      updateJob(jobId, { result: partialResult });
    } else if (audio) {
      partialResult.audio = audio;
      updateJob(jobId, { result: partialResult });
    } else {
      throw new Error("Missing audio result for resume.");
    }

    if (startStage === "script" || startStage === "audio" || startStage === "visual") {
      currentStage = "visual";
      updateJob(jobId, { stage: "visual", progress: 60, message: "正在生成画面..." });
      visual = await generateVisuals({
        scenes: script.scenes,
        aspect_ratio: input.aspectRatio,
      });
      partialResult.visual = visual;
      updateJob(jobId, { result: partialResult });
    } else if (visual) {
      partialResult.visual = visual;
      updateJob(jobId, { result: partialResult });
    } else {
      throw new Error("Missing visual result for resume.");
    }

    currentStage = "video";
    updateJob(jobId, { stage: "video", progress: 80, message: "正在合成视频..." });
    const merged = mergeScenes(
      script.scenes,
      audio.scenes,
      visual.scenes
    );

    const video = await assembleVideo({
      scenes: merged.map((scene) => ({
        scene_id: scene.scene_id,
        image_path: scene.image_path,
        video_path: scene.video_path,
        audio_path: scene.audio_path,
        duration_ms: scene.duration_ms,
        timestamps: scene.timestamps,
      })),
      projectTitle: input.topic,
      bgm_style: input.bgmStyle,
      bgm_enabled: input.bgmEnabled,
      bgm_path: input.bgmPath,
      aspect_ratio: input.aspectRatio,
    });
    const videoUrl = buildPublicMediaUrl(video.video_path);
    const srtUrl = buildPublicMediaUrl(video.srt_path);
    const videoWithUrls = {
      ...video,
      video_url: videoUrl ?? undefined,
      srt_url: srtUrl ?? undefined,
    };
    partialResult.video = videoWithUrls;
    updateJob(jobId, { result: partialResult });

    deductCredits(input.userId);

    updateJob(jobId, {
      stage: "completed",
      progress: 100,
      message: "已完成",
      result: partialResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateJob(jobId, {
      stage: "failed",
      progress: 100,
      message: "生成失败",
      error: message,
      result: partialResult,
      failedStage: currentStage,
    });
  }
}
