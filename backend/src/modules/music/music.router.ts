import { Router } from "express";
import {
  generateAIMusicHandler,
  generateMusicHandler,
  listMusicStylesHandler,
  sunoCallbackHandler,
} from "./music.controller";

const router = Router();

router.get("/styles", listMusicStylesHandler);
router.post("/generate", generateMusicHandler);
router.post("/ai/generate", generateAIMusicHandler);
router.post("/ai/callback", sunoCallbackHandler);

export default router;
