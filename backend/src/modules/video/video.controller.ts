import type { Request, Response } from "express";
import { buildPublicMediaUrl } from "../../utils/media";
import { assembleVideo } from "./video.service";
import type { VideoSceneInput } from "./video.types";
import { normalizeAspectRatio } from "../../utils/aspectRatio";

export async function assembleVideoHandler(req: Request, res: Response) {
  const {
    scenes,
    projectTitle,
    bgm_style,
    bgm_path,
    bgm_enabled,
    bgm_volume,
    aspect_ratio,
  } = req.body ?? {};
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: "scenes 必须是非空数组。" });
  }

  const inputScenes: VideoSceneInput[] = scenes;
  const invalidScene = inputScenes.find(
    (scene) =>
      !scene ||
      typeof scene.scene_id !== "number" ||
      typeof scene.audio_path !== "string" ||
      (!scene.image_path && !scene.video_path)
  );
  if (invalidScene) {
    return res.status(400).json({
      error: `scene ${invalidScene.scene_id ?? "unknown"} 缺少必要的音频或画面素材。`,
    });
  }

  try {
    const payload = await assembleVideo({
      scenes: inputScenes,
      projectTitle,
      bgm_style: typeof bgm_style === "string" ? bgm_style : undefined,
      bgm_path: typeof bgm_path === "string" ? bgm_path : undefined,
      bgm_enabled: typeof bgm_enabled === "boolean" ? bgm_enabled : undefined,
      bgm_volume: typeof bgm_volume === "number" ? bgm_volume : undefined,
      aspect_ratio: normalizeAspectRatio(
        typeof aspect_ratio === "string" ? aspect_ratio : undefined
      ),
    });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const videoUrl = buildPublicMediaUrl(payload.video_path, baseUrl);
    const srtUrl = buildPublicMediaUrl(payload.srt_path, baseUrl);

    return res.status(200).json({
      ...payload,
      video_url: videoUrl ?? undefined,
      srt_url: srtUrl ?? undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
