import { Router } from "express";
import { generateScriptHandler } from "./script.controller";

const router = Router();

router.post("/generate", generateScriptHandler);

export default router;
