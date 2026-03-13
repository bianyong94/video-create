type QwenChatEnv = {
  qwenChatApiKey: string;
  qwenChatBaseUrl: string;
  qwenChatPath: string;
  qwenChatModel: string;
  qwenChatTemperature: number;
  qwenChatMaxTokens: number;
};

type DashScopeEnv = {
  dashscopeApiKey: string;
  dashscopeWsUrl: string;
  dashscopeTtsModel: string;
  dashscopeTtsVoice: string;
  dashscopeTtsFormat: string;
  dashscopeTtsSampleRate: number;
  dashscopeAsrModel: string;
  dashscopeAsrFormat: string;
  dashscopeAsrSampleRate: number;
};

type ImageEnv = {
  imageProvider: "qwen" | "cogview";
  imageConcurrency: number;
  imageWidth: number;
  imageHeight: number;
  qwenApiKey: string;
  qwenApiBase: string;
  qwenApiPath: string;
  qwenModel: string;
  qwenTaskPollIntervalMs: number;
  qwenTaskTimeoutMs: number;
  cogviewApiKey: string;
  cogviewApiBase: string;
  cogviewApiPath: string;
  cogviewModel: string;
};

type SunoEnv = {
  sunoApiKey: string;
  sunoApiBase: string;
  sunoModel: string;
  sunoCallbackUrl: string;
  sunoPollIntervalMs: number;
  sunoTimeoutMs: number;
};

export const env = {
  qwenChatApiKey:
    process.env.QWEN_CHAT_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? "",
  qwenChatBaseUrl:
    process.env.QWEN_CHAT_BASE_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  qwenChatPath: process.env.QWEN_CHAT_PATH ?? "/chat/completions",
  qwenChatModel: process.env.QWEN_CHAT_MODEL ?? "qwen-plus",
  qwenChatTemperature: Number(process.env.QWEN_CHAT_TEMPERATURE ?? "0.2"),
  qwenChatMaxTokens: Number(process.env.QWEN_CHAT_MAX_TOKENS ?? "2000"),
  dashscopeApiKey: process.env.DASHSCOPE_API_KEY ?? "",
  dashscopeWsUrl:
    process.env.DASHSCOPE_WS_URL ?? "wss://dashscope.aliyuncs.com/api-ws/v1/inference/",
  dashscopeTtsModel: process.env.DASHSCOPE_TTS_MODEL ?? "cosyvoice-v3-flash",
  dashscopeTtsVoice: process.env.DASHSCOPE_TTS_VOICE ?? "longanyang",
  dashscopeTtsFormat: process.env.DASHSCOPE_TTS_FORMAT ?? "wav",
  dashscopeTtsSampleRate: Number(process.env.DASHSCOPE_TTS_SAMPLE_RATE ?? "16000"),
  dashscopeAsrModel: process.env.DASHSCOPE_ASR_MODEL ?? "fun-asr-realtime",
  dashscopeAsrFormat: process.env.DASHSCOPE_ASR_FORMAT ?? "wav",
  dashscopeAsrSampleRate: Number(process.env.DASHSCOPE_ASR_SAMPLE_RATE ?? "16000"),
  imageProvider: (process.env.IMAGE_PROVIDER ?? "qwen") as "qwen" | "cogview",
  imageConcurrency: Number(process.env.IMAGE_CONCURRENCY ?? "2"),
  imageWidth: Number(process.env.IMAGE_WIDTH ?? "1080"),
  imageHeight: Number(process.env.IMAGE_HEIGHT ?? "1920"),
  qwenApiKey: process.env.QWEN_IMAGE_API_KEY ?? "",
  qwenApiBase: process.env.QWEN_IMAGE_API_BASE ?? "",
  qwenApiPath: process.env.QWEN_IMAGE_PATH ?? "",
  qwenModel: process.env.QWEN_IMAGE_MODEL ?? "wanx-v1",
  qwenTaskPollIntervalMs: Number(process.env.QWEN_TASK_POLL_INTERVAL_MS ?? "1500"),
  qwenTaskTimeoutMs: Number(process.env.QWEN_TASK_TIMEOUT_MS ?? "180000"),
  cogviewApiKey: process.env.COGVIEW_API_KEY ?? "",
  cogviewApiBase: process.env.COGVIEW_IMAGE_API_BASE ?? "",
  cogviewApiPath: process.env.COGVIEW_IMAGE_PATH ?? "",
  cogviewModel: process.env.COGVIEW_IMAGE_MODEL ?? "cogview-3-plus",
  sunoApiKey: process.env.SUNO_API_KEY ?? "",
  sunoApiBase: process.env.SUNO_API_BASE ?? "https://api.sunoapi.org",
  sunoModel: process.env.SUNO_MODEL ?? "V4_5ALL",
  sunoCallbackUrl:
    process.env.SUNO_CALLBACK_URL ?? "http://localhost:3001/api/music/ai/callback",
  sunoPollIntervalMs: Number(process.env.SUNO_POLL_INTERVAL_MS ?? "2000"),
  sunoTimeoutMs: Number(process.env.SUNO_TIMEOUT_MS ?? "240000"),
};

export function getQwenChatConfig(): QwenChatEnv {
  const missing: string[] = [];
  if (!env.qwenChatApiKey) missing.push("QWEN_CHAT_API_KEY or DASHSCOPE_API_KEY");
  if (!env.qwenChatBaseUrl) missing.push("QWEN_CHAT_BASE_URL");
  if (!env.qwenChatPath) missing.push("QWEN_CHAT_PATH");

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    qwenChatApiKey: env.qwenChatApiKey,
    qwenChatBaseUrl: env.qwenChatBaseUrl,
    qwenChatPath: env.qwenChatPath,
    qwenChatModel: env.qwenChatModel,
    qwenChatTemperature: env.qwenChatTemperature,
    qwenChatMaxTokens: env.qwenChatMaxTokens,
  };
}

export function getDashScopeConfig(): DashScopeEnv {
  const missing: string[] = [];
  if (!env.dashscopeApiKey) missing.push("DASHSCOPE_API_KEY");
  if (!env.dashscopeWsUrl) missing.push("DASHSCOPE_WS_URL");

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    dashscopeApiKey: env.dashscopeApiKey,
    dashscopeWsUrl: env.dashscopeWsUrl,
    dashscopeTtsModel: env.dashscopeTtsModel,
    dashscopeTtsVoice: env.dashscopeTtsVoice,
    dashscopeTtsFormat: env.dashscopeTtsFormat,
    dashscopeTtsSampleRate: env.dashscopeTtsSampleRate,
    dashscopeAsrModel: env.dashscopeAsrModel,
    dashscopeAsrFormat: env.dashscopeAsrFormat,
    dashscopeAsrSampleRate: env.dashscopeAsrSampleRate,
  };
}

export function getImageConfig(): ImageEnv {
  const missing: string[] = [];
  if (!env.imageProvider) missing.push("IMAGE_PROVIDER");

  if (env.imageProvider === "qwen") {
    if (!env.qwenApiKey) missing.push("QWEN_IMAGE_API_KEY");
    if (!env.qwenApiBase) missing.push("QWEN_IMAGE_API_BASE");
    if (!env.qwenApiPath) missing.push("QWEN_IMAGE_PATH");
  }

  if (env.imageProvider === "cogview") {
    if (!env.cogviewApiKey) missing.push("COGVIEW_API_KEY");
    if (!env.cogviewApiBase) missing.push("COGVIEW_IMAGE_API_BASE");
    if (!env.cogviewApiPath) missing.push("COGVIEW_IMAGE_PATH");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    imageProvider: env.imageProvider,
    imageConcurrency: env.imageConcurrency,
    imageWidth: env.imageWidth,
    imageHeight: env.imageHeight,
    qwenApiKey: env.qwenApiKey,
    qwenApiBase: env.qwenApiBase,
    qwenApiPath: env.qwenApiPath,
    qwenModel: env.qwenModel,
    qwenTaskPollIntervalMs: env.qwenTaskPollIntervalMs,
    qwenTaskTimeoutMs: env.qwenTaskTimeoutMs,
    cogviewApiKey: env.cogviewApiKey,
    cogviewApiBase: env.cogviewApiBase,
    cogviewApiPath: env.cogviewApiPath,
    cogviewModel: env.cogviewModel,
  };
}

export function getSunoConfig(): SunoEnv {
  const missing: string[] = [];
  if (!env.sunoApiKey) missing.push("SUNO_API_KEY");
  if (!env.sunoApiBase) missing.push("SUNO_API_BASE");
  if (!env.sunoCallbackUrl) missing.push("SUNO_CALLBACK_URL");

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    sunoApiKey: env.sunoApiKey,
    sunoApiBase: env.sunoApiBase,
    sunoModel: env.sunoModel,
    sunoCallbackUrl: env.sunoCallbackUrl,
    sunoPollIntervalMs: env.sunoPollIntervalMs,
    sunoTimeoutMs: env.sunoTimeoutMs,
  };
}
