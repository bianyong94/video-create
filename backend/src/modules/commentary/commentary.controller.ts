import { promises as fs } from "fs";
import path from "path";
import type { Request, Response } from "express";
import multer from "multer";
import {
  analyzeCommentaryProject,
  createCommentaryProjectFromLocalPath,
  createCommentaryProjectFromUploadedFile,
  getCommentaryProject,
  segmentCommentaryProject,
  updateCommentarySegment,
} from "./commentary.service";

const baseDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
const uploadTempDir = path.join(baseDir, "commentary-assets", "tmp");

await fs.mkdir(uploadTempDir, { recursive: true });

export const commentaryUploadMiddleware = multer({
  dest: uploadTempDir,
  limits: {
    fileSize: 20 * 1024 * 1024 * 1024,
  },
});

export async function createCommentaryProjectHandler(req: Request, res: Response) {
  const userId = req.header("x-user-id");
  const { title, sourcePath } = req.body ?? {};
  if (!userId) return res.status(401).json({ error: "Missing x-user-id header." });
  if (typeof sourcePath !== "string" || !sourcePath.trim()) {
    return res.status(400).json({ error: "sourcePath 必须是非空字符串。" });
  }
  try {
    const project = await createCommentaryProjectFromLocalPath({
      userId,
      title: typeof title === "string" ? title : undefined,
      sourcePath: sourcePath.trim(),
    });
    return res.status(200).json(project);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function uploadCommentaryProjectHandler(req: Request, res: Response) {
  const userId = req.header("x-user-id");
  const uploaded = req.file;
  const title = typeof req.body?.title === "string" ? req.body.title : undefined;
  if (!userId) return res.status(401).json({ error: "Missing x-user-id header." });
  if (!uploaded) {
    return res.status(400).json({ error: "请上传视频文件。" });
  }
  try {
    const project = await createCommentaryProjectFromUploadedFile({
      userId,
      title,
      originalName: uploaded.originalname,
      tempFilePath: uploaded.path,
    });
    return res.status(200).json(project);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function getCommentaryProjectHandler(req: Request, res: Response) {
  try {
    return res.status(200).json(getCommentaryProject(req.params.projectId));
  } catch (error) {
    return res.status(404).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function segmentCommentaryProjectHandler(req: Request, res: Response) {
  const { segmentMinutes } = req.body ?? {};
  try {
    const project = await segmentCommentaryProject(
      req.params.projectId,
      typeof segmentMinutes === "number" ? segmentMinutes : undefined
    );
    return res.status(200).json(project);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function analyzeCommentaryProjectHandler(req: Request, res: Response) {
  const { segmentIds } = req.body ?? {};
  try {
    const project = await analyzeCommentaryProject(
      req.params.projectId,
      Array.isArray(segmentIds) ? segmentIds.filter((item): item is string => typeof item === "string") : undefined
    );
    return res.status(200).json(project);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function updateCommentarySegmentHandler(req: Request, res: Response) {
  try {
    const project = updateCommentarySegment(req.params.projectId, req.params.segmentId, req.body ?? {});
    return res.status(200).json(project);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}
