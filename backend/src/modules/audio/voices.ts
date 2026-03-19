import { env } from "../../config/env";

const DEFAULT_DASHSCOPE_VOICES = [
  "longanyang",
  "longxiaochun",
  "longxiaoxia",
  "longyue",
  "longnan",
  "longjing",
  "longwan",
  "longying",
  "longchen",
  "longxiaoqiang",
  "longmiao",
  "longshu",
  "longhui",
  "longtian",
  "longfei",
  "longqian",
];

const DEFAULT_EDGE_VOICES = [
  "zh-CN-XiaoxiaoNeural",
  "zh-CN-XiaoyiNeural",
  "zh-CN-YunxiNeural",
  "zh-CN-YunjianNeural",
  "zh-CN-YunyangNeural",
  "zh-CN-XiaochenNeural",
  "zh-CN-XiaomoNeural",
];

export function getDashScopeVoices(): string[] {
  const raw =
    env.ttsProvider === "edge"
      ? process.env.EDGE_TTS_VOICES
      : process.env.DASHSCOPE_TTS_VOICES;
  const fallback =
    env.ttsProvider === "edge" ? DEFAULT_EDGE_VOICES : DEFAULT_DASHSCOPE_VOICES;
  if (!raw) return fallback;
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parsed.length > 0 ? parsed : fallback;
}
