import { Router } from "express";
import {
  mockWeChatPay,
  mockAlipay,
  mockStripe,
} from "../services/billing/mockBilling.controller";

const router = Router();

router.post("/wechat/mock", mockWeChatPay);
router.post("/alipay/mock", mockAlipay);
router.post("/stripe/mock", mockStripe);

export default router;
