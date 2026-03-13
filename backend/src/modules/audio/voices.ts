const DEFAULT_VOICES = [
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

export function getDashScopeVoices(): string[] {
  const raw = process.env.DASHSCOPE_TTS_VOICES;
  if (!raw) return DEFAULT_VOICES;
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parsed.length > 0 ? parsed : DEFAULT_VOICES;
}
