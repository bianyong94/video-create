import { Router } from "express";
import {
  analyzeCommentaryProjectHandler,
  commentaryUploadMiddleware,
  createCommentaryProjectHandler,
  getCommentaryProjectHandler,
  segmentCommentaryProjectHandler,
  uploadCommentaryProjectHandler,
  updateCommentarySegmentHandler,
} from "./commentary.controller";

const router = Router();

router.post("/projects", createCommentaryProjectHandler);
router.post("/projects/upload", commentaryUploadMiddleware.single("file"), uploadCommentaryProjectHandler);
router.get("/projects/:projectId", getCommentaryProjectHandler);
router.post("/projects/:projectId/segmentize", segmentCommentaryProjectHandler);
router.post("/projects/:projectId/analyze", analyzeCommentaryProjectHandler);
router.patch("/projects/:projectId/segments/:segmentId", updateCommentarySegmentHandler);

export default router;
