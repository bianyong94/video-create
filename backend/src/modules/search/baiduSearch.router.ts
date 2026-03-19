import { Router } from "express";
import { baiduSearchHandler } from "./baiduSearch.controller";

const router = Router();

router.post("/baidu", baiduSearchHandler);

export default router;
