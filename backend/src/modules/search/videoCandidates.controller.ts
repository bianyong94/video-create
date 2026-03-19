import type { Request, Response } from "express";
import { buildPublicMediaUrl } from "../../utils/media";
import { normalizeAspectRatio } from "../../utils/aspectRatio";
import { searchVideoCandidates } from "./videoCandidates.service";

export async function videoCandidatesHandler(req: Request, res: Response) {
  const { query, count, aspect_ratio } = req.body ?? {};

  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query 必须是非空字符串。" });
  }

  try {
    const results = await searchVideoCandidates({
      query: query.trim(),
      count: typeof count === "number" ? count : undefined,
      aspect_ratio: normalizeAspectRatio(
        typeof aspect_ratio === "string" ? aspect_ratio : undefined
      ),
    });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const enrichedResults = results.map((item) => ({
      ...item,
      preview_url: item.preview_path
        ? buildPublicMediaUrl(item.preview_path, baseUrl) ?? undefined
        : undefined,
    }));
    return res.status(200).json({
      query: query.trim(),
      count: enrichedResults.length,
      results: enrichedResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
