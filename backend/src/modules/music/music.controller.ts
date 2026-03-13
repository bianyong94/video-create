import type { Request, Response } from "express";
import { listMusicStyles, pickBgm } from "./music.service";
import { buildPublicMediaUrl } from "../../utils/media";
import { generateAIMusic } from "./suno.service";

export async function listMusicStylesHandler(_req: Request, res: Response) {
  const styles = await listMusicStyles();
  return res.status(200).json({ styles });
}

export async function generateMusicHandler(req: Request, res: Response) {
  const { style } = req.body ?? {};
  const selected = await pickBgm(typeof style === "string" ? style : undefined);
  if (!selected) {
    return res.status(404).json({ error: "No music available for this style." });
  }
  const url = buildPublicMediaUrl(selected, `${req.protocol}://${req.get("host")}`);
  return res.status(200).json({
    style: typeof style === "string" ? style : "default",
    bgm_path: selected,
    bgm_url: url ?? undefined,
  });
}

export async function generateAIMusicHandler(req: Request, res: Response) {
  const { prompt, style, title, instrumental } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt 必填。" });
  }
  try {
    const result = await generateAIMusic({
      prompt,
      style: typeof style === "string" ? style : undefined,
      title: typeof title === "string" ? title : undefined,
      instrumental: typeof instrumental === "boolean" ? instrumental : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}

export async function sunoCallbackHandler(req: Request, res: Response) {
  return res.status(200).json({ ok: true });
}
