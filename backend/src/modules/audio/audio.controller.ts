import type { Request, Response } from "express";
import { generateAudioAndTimestamps } from "./audio.service";
import type { ScriptScene } from "../../utils/json";

export async function generateAudioHandler(req: Request, res: Response) {
  const { scenes, voice } = req.body ?? {};
  if (!Array.isArray(scenes)) {
    return res.status(400).json({ error: "scenes 必须是数组。" });
  }

  const inputScenes: ScriptScene[] = scenes;

  try {
    const payload = await generateAudioAndTimestamps({
      scenes: inputScenes,
      voice: typeof voice === "string" ? voice : undefined,
    });
    return res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
