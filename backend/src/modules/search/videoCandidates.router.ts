import { Router } from "express";
import { videoCandidatesHandler } from "./videoCandidates.controller";

const router = Router();

router.post("/video", videoCandidatesHandler);

export default router;
