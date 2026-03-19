import type { Request, Response } from "express";
import { searchBaiduWeb } from "./baiduSearch.service";

export async function baiduSearchHandler(req: Request, res: Response) {
  const { query, count, freshness } = req.body ?? {};

  if (typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query 必须是非空字符串。" });
  }

  try {
    const results = await searchBaiduWeb({
      query: query.trim(),
      count: typeof count === "number" ? count : undefined,
      freshness: typeof freshness === "string" ? freshness : undefined,
    });

    return res.status(200).json({
      query: query.trim(),
      count: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
