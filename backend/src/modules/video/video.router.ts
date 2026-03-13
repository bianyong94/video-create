import { Router } from "express";
import { assembleVideoHandler } from "./video.controller";

const router = Router();

router.post("/assemble", assembleVideoHandler);

export default router;
