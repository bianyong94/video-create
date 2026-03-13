import type { Request, Response } from "express";

export function mockWeChatPay(req: Request, res: Response) {
  return res.status(200).json({
    provider: "wechat",
    status: "ok",
    mock_checkout_url: "https://pay.example.com/wechat/mock",
  });
}

export function mockAlipay(req: Request, res: Response) {
  return res.status(200).json({
    provider: "alipay",
    status: "ok",
    mock_checkout_url: "https://pay.example.com/alipay/mock",
  });
}

export function mockStripe(req: Request, res: Response) {
  return res.status(200).json({
    provider: "stripe",
    status: "ok",
    mock_checkout_url: "https://pay.example.com/stripe/mock",
  });
}
