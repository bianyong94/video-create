import type { Request, Response } from "express";
import { generateVisuals } from "./visual.service";
import type { ScriptScene } from "../../utils/json";
import { normalizeAspectRatio } from "../../utils/aspectRatio";
import { buildPublicMediaUrl } from "../../utils/media";

export async function generateVisualsHandler(req: Request, res: Response) {
  const { scenes, selections, aspect_ratio } = req.body ?? {};
  if (!Array.isArray(scenes)) {
    return res.status(400).json({ error: "scenes 必须是数组。" });
  }
  if (selections !== undefined && !Array.isArray(selections)) {
    return res.status(400).json({ error: "selections 必须是数组。" });
  }

  const inputScenes: ScriptScene[] = scenes;

  try {
    const payload = await generateVisuals({
      scenes: inputScenes,
      selections: Array.isArray(selections) ? selections : undefined,
      aspect_ratio: normalizeAspectRatio(
        typeof aspect_ratio === "string" ? aspect_ratio : undefined
      ),
    });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    return res.status(200).json(enrichVisualResponse(payload, baseUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

export function enrichVisualResponse(payload: Awaited<ReturnType<typeof generateVisuals>>, baseUrl: string) {
  return {
    ...payload,
    scenes: payload.scenes.map((scene) => ({
      ...scene,
      candidates: scene.candidates?.map((candidate) => ({
        ...candidate,
        preview_url: candidate.preview_path
          ? buildPublicMediaUrl(candidate.preview_path, baseUrl) ?? candidate.preview_url
          : candidate.preview_url,
      })),
    })),
  };
}
