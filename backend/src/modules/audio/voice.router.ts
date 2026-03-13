import { Router } from "express";
import { getDashScopeVoices } from "./voices";
import { generateVoicePreview } from "./voicePreview.service";

const router = Router();

router.get("/list", (_req, res) => {
  res.status(200).json({ voices: getDashScopeVoices() });
});

router.post("/preview", async (req, res) => {
  const { voice, text } = req.body ?? {};
  try {
    const result = await generateVoicePreview(
      typeof voice === "string" ? voice : undefined,
      typeof text === "string" ? text : undefined
    );
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

export default router;
