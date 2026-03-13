import type { Request, Response } from "express";
import { generateVisuals } from "./visual.service";
import type { ScriptScene } from "../../utils/json";

export async function generateVisualsHandler(req: Request, res: Response) {
  const { scenes } = req.body ?? {};
  if (!Array.isArray(scenes)) {
    return res.status(400).json({ error: "scenes 必须是数组。" });
  }

  const inputScenes: ScriptScene[] = scenes;

  try {
    const payload = await generateVisuals({ scenes: inputScenes });
    return res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
