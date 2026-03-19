import type { Request, Response } from "express";
import { resumePipeline, startPipeline, startPipelineFromPartial } from "./orchestrator.service";
import { getJob } from "./job.store";
import { normalizeAspectRatio } from "../../utils/aspectRatio";

export async function startPipelineHandler(req: Request, res: Response) {
  const {
    topic,
    sourceUrl,
    sceneCount,
    narrationDensity,
    targetDurationMinutes,
    aspect_ratio,
    voice,
    bgmStyle,
    bgmEnabled,
    bgmPath,
  } = req.body ?? {};
  const userId = req.header("x-user-id");

  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id header." });
  }

  if ((!topic || typeof topic !== "string") && (!sourceUrl || typeof sourceUrl !== "string")) {
    return res.status(400).json({ error: "topic 或 sourceUrl 至少提供一个。" });
  }

  const result = startPipeline({
    topic: typeof topic === "string" ? topic : undefined,
    sourceUrl: typeof sourceUrl === "string" ? sourceUrl : undefined,
    sceneCount: typeof sceneCount === "number" ? sceneCount : undefined,
    narrationDensity:
      narrationDensity === "short" ||
      narrationDensity === "medium" ||
      narrationDensity === "long"
        ? narrationDensity
        : undefined,
    targetDurationMinutes:
      typeof targetDurationMinutes === "number" ? targetDurationMinutes : undefined,
    aspectRatio: normalizeAspectRatio(
      typeof aspect_ratio === "string" ? aspect_ratio : undefined
    ),
    userId,
    voice: typeof voice === "string" ? voice : undefined,
    bgmStyle: typeof bgmStyle === "string" ? bgmStyle : undefined,
    bgmEnabled: typeof bgmEnabled === "boolean" ? bgmEnabled : undefined,
    bgmPath: typeof bgmPath === "string" ? bgmPath : undefined,
  });

  return res.status(202).json(result);
}

export async function getPipelineStatusHandler(req: Request, res: Response) {
  const { jobId } = req.params;
  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId." });
  }

  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found." });
  }

  return res.status(200).json(job);
}

export async function retryPipelineHandler(req: Request, res: Response) {
  const { jobId } = req.params;
  const userId = req.header("x-user-id");
  const {
    topic,
    sourceUrl,
    sceneCount,
    narrationDensity,
    targetDurationMinutes,
    aspect_ratio,
    failedStage,
    partial,
    voice,
    bgmStyle,
    bgmEnabled,
    bgmPath,
  } = req.body ?? {};

  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId." });
  }
  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id header." });
  }

  try {
    const result = resumePipeline(jobId, {
      userId,
      topic: typeof topic === "string" ? topic : undefined,
      sourceUrl: typeof sourceUrl === "string" ? sourceUrl : undefined,
      sceneCount: typeof sceneCount === "number" ? sceneCount : undefined,
      narrationDensity:
        narrationDensity === "short" ||
        narrationDensity === "medium" ||
        narrationDensity === "long"
          ? narrationDensity
          : undefined,
      targetDurationMinutes:
        typeof targetDurationMinutes === "number" ? targetDurationMinutes : undefined,
      aspectRatio: normalizeAspectRatio(
        typeof aspect_ratio === "string" ? aspect_ratio : undefined
      ),
      voice: typeof voice === "string" ? voice : undefined,
      bgmStyle: typeof bgmStyle === "string" ? bgmStyle : undefined,
      bgmEnabled: typeof bgmEnabled === "boolean" ? bgmEnabled : undefined,
      bgmPath: typeof bgmPath === "string" ? bgmPath : undefined,
    });
    return res.status(202).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Job not found." && failedStage && partial) {
      try {
        const result = startPipelineFromPartial(
          {
            userId,
            topic: typeof topic === "string" ? topic : undefined,
            sourceUrl: typeof sourceUrl === "string" ? sourceUrl : undefined,
            sceneCount: typeof sceneCount === "number" ? sceneCount : undefined,
            narrationDensity:
              narrationDensity === "short" ||
              narrationDensity === "medium" ||
              narrationDensity === "long"
                ? narrationDensity
                : undefined,
            targetDurationMinutes:
              typeof targetDurationMinutes === "number"
                ? targetDurationMinutes
                : undefined,
            aspectRatio: normalizeAspectRatio(
              typeof aspect_ratio === "string" ? aspect_ratio : undefined
            ),
            voice: typeof voice === "string" ? voice : undefined,
            bgmStyle: typeof bgmStyle === "string" ? bgmStyle : undefined,
            bgmEnabled: typeof bgmEnabled === "boolean" ? bgmEnabled : undefined,
            bgmPath: typeof bgmPath === "string" ? bgmPath : undefined,
          },
          failedStage,
          partial
        );
        return res.status(202).json(result);
      } catch (innerError) {
        const innerMessage =
          innerError instanceof Error ? innerError.message : "Unknown error";
        return res.status(400).json({ error: innerMessage });
      }
    }
    return res.status(400).json({ error: message });
  }
}
