import type { Request, Response, NextFunction } from "express";
import { ensureCredits, DEFAULT_COST } from "../services/credits.service";

export function creditsMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = req.header("x-user-id");
  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id header." });
  }

  try {
    ensureCredits(userId, DEFAULT_COST);
    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Insufficient credits." ? 402 : 400;
    return res.status(status).json({ error: message });
  }
}
