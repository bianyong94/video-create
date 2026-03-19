import type { Request, Response } from "express";
import { generateScript } from "./script.service";
import { normalizeAspectRatio } from "../../utils/aspectRatio";

export async function generateScriptHandler(req: Request, res: Response) {
  const {
    topic,
    sourceUrl,
    sceneCount,
    narrationDensity,
    targetDurationMinutes,
    aspect_ratio,
  } = req.body ?? {};

  if ((!topic || typeof topic !== "string") && (!sourceUrl || typeof sourceUrl !== "string")) {
    return res.status(400).json({
      error: "topic 或 sourceUrl 至少提供一个。",
    });
  }

  try {
    const payload = await generateScript({
      topic: topic ?? "未命名主题",
      sourceUrl,
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
    });
    return res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
