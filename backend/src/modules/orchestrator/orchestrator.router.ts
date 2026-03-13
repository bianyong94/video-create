import { Router } from "express";
import { creditsMiddleware } from "../../middlewares/credits";
import {
  startPipelineHandler,
  getPipelineStatusHandler,
  retryPipelineHandler,
} from "./orchestrator.controller";

const router = Router();

router.post("/run", creditsMiddleware, startPipelineHandler);
router.post("/retry/:jobId", creditsMiddleware, retryPipelineHandler);
router.get("/status/:jobId", getPipelineStatusHandler);

export default router;
