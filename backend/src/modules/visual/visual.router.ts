import { Router } from "express";
import { generateVisualsHandler } from "./visual.controller";

const router = Router();

router.post("/generate", generateVisualsHandler);

export default router;
