import { Router } from "express";
import { generateAudioHandler } from "./audio.controller";

const router = Router();

router.post("/generate", generateAudioHandler);

export default router;
