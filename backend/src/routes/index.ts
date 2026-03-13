import { Router } from "express";
import scriptRouter from "../modules/script/script.router";
import audioRouter from "../modules/audio/audio.router";
import voiceRouter from "../modules/audio/voice.router";
import musicRouter from "../modules/music/music.router";
import visualRouter from "../modules/visual/visual.router";
import videoRouter from "../modules/video/video.router";
import orchestratorRouter from "../modules/orchestrator/orchestrator.router";
import billingRouter from "./billing.router";

const router = Router();

router.use("/script", scriptRouter);
router.use("/audio", audioRouter);
router.use("/voice", voiceRouter);
router.use("/music", musicRouter);
router.use("/visual", visualRouter);
router.use("/video", videoRouter);
router.use("/orchestrator", orchestratorRouter);
router.use("/billing", billingRouter);

export default router;
