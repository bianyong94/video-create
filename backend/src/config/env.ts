type QwenChatEnv = {
  qwenChatApiKey: string;
  qwenChatBaseUrl: string;
  qwenChatPath: string;
  qwenChatModel: string;
  qwenChatTemperature: number;
  qwenChatMaxTokens: number;
};

type OpenAIEnv = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiChatModel: string;
  openaiImageModel: string;
};

type OllamaEnv = {
  ollamaBaseUrl: string;
  ollamaChatModel: string;
  ollamaTimeoutMs: number;
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

type TtsEnv = {
  ttsProvider: "dashscope" | "edge";
  edgeTtsPythonBin: string;
  edgeTtsScriptPath: string;
  edgeTtsVoice: string;
};

type AudioEnv = {
  asrProvider: "dashscope" | "faster_whisper";
  fasterWhisperPythonBin: string;
  fasterWhisperScriptPath: string;
  fasterWhisperModel: string;
  fasterWhisperComputeType: string;
  fasterWhisperLanguage: string;
  fasterWhisperBeamSize: number;
  fasterWhisperWordTimestamps: boolean;
};

type ImageEnv = {
  imageProvider:
    | "qwen"
    | "cogview"
    | "openai"
    | "pexels"
    | "pixabay"
    | "wikimedia"
    | "openverse"
    | "loc"
    | "smithsonian"
    | "europeana"
    | "internet_archive"
    | "baidu_image"
    | "so_image"
    | "stock";
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
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiImageModel: string;
  pexelsApiKey: string;
  pixabayApiKey: string;
  europeanaApiKey: string;
  smithsonianApiKey: string;
};

type SearchEnv = {
  baiduApiKey: string;
};

type SunoEnv = {
  sunoApiKey: string;
  sunoApiBase: string;
  sunoModel: string;
  sunoCallbackUrl: string;
  sunoPollIntervalMs: number;
  sunoTimeoutMs: number;
};

type VideoEnv = {
  audioConcurrency: number;
  videoFps: number;
  minSceneDurationMs: number;
  maxSceneDurationMs: number;
  charsPerSecond: number;
};

type ScriptEnv = {
  scriptProvider: "qwen" | "openai" | "ollama";
};

export const env = {
  scriptProvider: (process.env.SCRIPT_PROVIDER ?? "qwen") as
    | "qwen"
    | "openai"
    | "ollama",
  qwenChatApiKey:
    process.env.QWEN_CHAT_API_KEY ?? process.env.DASHSCOPE_API_KEY ?? "",
  qwenChatBaseUrl:
    process.env.QWEN_CHAT_BASE_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  qwenChatPath: process.env.QWEN_CHAT_PATH ?? "/chat/completions",
  qwenChatModel: process.env.QWEN_CHAT_MODEL ?? "qwen-plus",
  qwenChatTemperature: Number(process.env.QWEN_CHAT_TEMPERATURE ?? "0.2"),
  qwenChatMaxTokens: Number(process.env.QWEN_CHAT_MAX_TOKENS ?? "2000"),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiChatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  ollamaChatModel: process.env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b-instruct",
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? "120000"),
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
  ttsProvider: (process.env.TTS_PROVIDER ?? "edge") as "dashscope" | "edge",
  edgeTtsPythonBin: process.env.EDGE_TTS_PYTHON_BIN ?? "python3",
  edgeTtsScriptPath:
    process.env.EDGE_TTS_SCRIPT_PATH ?? "scripts/edge_tts_synthesize.py",
  edgeTtsVoice: process.env.EDGE_TTS_VOICE ?? "zh-CN-XiaoxiaoNeural",
  imageProvider: (process.env.IMAGE_PROVIDER ?? "stock") as
    | "qwen"
    | "cogview"
    | "openai"
    | "pexels"
    | "pixabay"
    | "wikimedia"
    | "openverse"
    | "loc"
    | "smithsonian"
    | "europeana"
    | "internet_archive"
    | "baidu_image"
    | "so_image"
    | "stock",
  imageConcurrency: Number(process.env.IMAGE_CONCURRENCY ?? "2"),
  imageWidth: Number(process.env.IMAGE_WIDTH ?? "1080"),
  imageHeight: Number(process.env.IMAGE_HEIGHT ?? "1920"),
  qwenApiKey: process.env.QWEN_IMAGE_API_KEY ?? "",
  qwenApiBase: process.env.QWEN_IMAGE_API_BASE ?? "",
  qwenApiPath: process.env.QWEN_IMAGE_PATH ?? "",
  qwenModel: process.env.QWEN_IMAGE_MODEL ?? "wanx-v1",
  qwenTaskPollIntervalMs: Number(process.env.QWEN_TASK_POLL_INTERVAL_MS ?? "2000"),
  qwenTaskTimeoutMs: Number(process.env.QWEN_TASK_TIMEOUT_MS ?? "300000"),
  cogviewApiKey: process.env.COGVIEW_API_KEY ?? "",
  cogviewApiBase: process.env.COGVIEW_IMAGE_API_BASE ?? "",
  cogviewApiPath: process.env.COGVIEW_IMAGE_PATH ?? "",
  cogviewModel: process.env.COGVIEW_IMAGE_MODEL ?? "cogview-3-plus",
  pexelsApiKey: process.env.PEXELS_API_KEY ?? "",
  pixabayApiKey: process.env.PIXABAY_API_KEY ?? "",
  europeanaApiKey: process.env.EUROPEANA_API_KEY ?? "",
  smithsonianApiKey: process.env.SMITHSONIAN_API_KEY ?? "",
  sunoApiKey: process.env.SUNO_API_KEY ?? "",
  sunoApiBase: process.env.SUNO_API_BASE ?? "https://api.sunoapi.org",
  sunoModel: process.env.SUNO_MODEL ?? "V4_5ALL",
  sunoCallbackUrl:
    process.env.SUNO_CALLBACK_URL ?? "http://localhost:3001/api/music/ai/callback",
  sunoPollIntervalMs: Number(process.env.SUNO_POLL_INTERVAL_MS ?? "2000"),
  sunoTimeoutMs: Number(process.env.SUNO_TIMEOUT_MS ?? "240000"),
  audioConcurrency: Number(process.env.AUDIO_CONCURRENCY ?? "3"),
  videoFps: Number(process.env.VIDEO_FPS ?? "24"),
  minSceneDurationMs: Number(process.env.MIN_SCENE_DURATION_MS ?? "800"),
  maxSceneDurationMs: Number(process.env.MAX_SCENE_DURATION_MS ?? "30000"),
  charsPerSecond: Number(process.env.NARRATION_CHARS_PER_SECOND ?? "4.5"),
  asrProvider: (process.env.ASR_PROVIDER ?? "dashscope") as
    | "dashscope"
    | "faster_whisper",
  fasterWhisperPythonBin: process.env.FASTER_WHISPER_PYTHON_BIN ?? "python3",
  fasterWhisperScriptPath:
    process.env.FASTER_WHISPER_SCRIPT_PATH ??
    "scripts/faster_whisper_transcribe.py",
  fasterWhisperModel: process.env.FASTER_WHISPER_MODEL ?? "small",
  fasterWhisperComputeType: process.env.FASTER_WHISPER_COMPUTE_TYPE ?? "int8",
  fasterWhisperLanguage: process.env.FASTER_WHISPER_LANGUAGE ?? "zh",
  fasterWhisperBeamSize: Number(process.env.FASTER_WHISPER_BEAM_SIZE ?? "5"),
  fasterWhisperWordTimestamps:
    (process.env.FASTER_WHISPER_WORD_TIMESTAMPS ?? "true").toLowerCase() !==
    "false",
  baiduApiKey: process.env.BAIDU_API_KEY ?? "",
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

export function getOpenAIConfig(): OpenAIEnv {
  const missing: string[] = [];
  if (!env.openaiApiKey) missing.push("OPENAI_API_KEY");
  if (!env.openaiBaseUrl) missing.push("OPENAI_BASE_URL");
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  return {
    openaiApiKey: env.openaiApiKey,
    openaiBaseUrl: env.openaiBaseUrl,
    openaiChatModel: env.openaiChatModel,
    openaiImageModel: env.openaiImageModel,
  };
}

export function getOllamaConfig(): OllamaEnv {
  const missing: string[] = [];
  if (!env.ollamaBaseUrl) missing.push("OLLAMA_BASE_URL");
  if (!env.ollamaChatModel) missing.push("OLLAMA_CHAT_MODEL");
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  return {
    ollamaBaseUrl: env.ollamaBaseUrl,
    ollamaChatModel: env.ollamaChatModel,
    ollamaTimeoutMs: Math.max(30000, env.ollamaTimeoutMs),
  };
}

export function getScriptConfig(): ScriptEnv {
  return {
    scriptProvider: env.scriptProvider,
  };
}

export function getAudioConfig(): AudioEnv {
  return {
    asrProvider: env.asrProvider,
    fasterWhisperPythonBin: env.fasterWhisperPythonBin,
    fasterWhisperScriptPath: env.fasterWhisperScriptPath,
    fasterWhisperModel: env.fasterWhisperModel,
    fasterWhisperComputeType: env.fasterWhisperComputeType,
    fasterWhisperLanguage: env.fasterWhisperLanguage,
    fasterWhisperBeamSize: Math.max(1, env.fasterWhisperBeamSize),
    fasterWhisperWordTimestamps: env.fasterWhisperWordTimestamps,
  };
}

export function getTtsConfig(): TtsEnv {
  const missing: string[] = [];
  if (env.ttsProvider === "edge") {
    if (!env.edgeTtsPythonBin) missing.push("EDGE_TTS_PYTHON_BIN");
    if (!env.edgeTtsScriptPath) missing.push("EDGE_TTS_SCRIPT_PATH");
  }
  if (env.ttsProvider === "dashscope") {
    if (!env.dashscopeApiKey) missing.push("DASHSCOPE_API_KEY");
    if (!env.dashscopeWsUrl) missing.push("DASHSCOPE_WS_URL");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  return {
    ttsProvider: env.ttsProvider,
    edgeTtsPythonBin: env.edgeTtsPythonBin,
    edgeTtsScriptPath: env.edgeTtsScriptPath,
    edgeTtsVoice: env.edgeTtsVoice,
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

  if (env.imageProvider === "openai") {
    if (!env.openaiApiKey) missing.push("OPENAI_API_KEY");
    if (!env.openaiBaseUrl) missing.push("OPENAI_BASE_URL");
  }

  if (env.imageProvider === "pexels" && !env.pexelsApiKey) {
    missing.push("PEXELS_API_KEY");
  }

  if (env.imageProvider === "pixabay" && !env.pixabayApiKey) {
    missing.push("PIXABAY_API_KEY");
  }

  if (env.imageProvider === "europeana" && !env.europeanaApiKey) {
    missing.push("EUROPEANA_API_KEY");
  }

  if (env.imageProvider === "smithsonian" && !env.smithsonianApiKey) {
    missing.push("SMITHSONIAN_API_KEY");
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
    openaiApiKey: env.openaiApiKey,
    openaiBaseUrl: env.openaiBaseUrl,
    openaiImageModel: env.openaiImageModel,
    pexelsApiKey: env.pexelsApiKey,
    pixabayApiKey: env.pixabayApiKey,
    europeanaApiKey: env.europeanaApiKey,
    smithsonianApiKey: env.smithsonianApiKey,
  };
}

export function getSearchConfig(): SearchEnv {
  const missing: string[] = [];
  if (!env.baiduApiKey) missing.push("BAIDU_API_KEY");
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  return {
    baiduApiKey: env.baiduApiKey,
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

export function getVideoConfig(): VideoEnv {
  return {
    audioConcurrency: Math.max(1, env.audioConcurrency),
    videoFps: Math.max(12, env.videoFps),
    minSceneDurationMs: Math.max(300, env.minSceneDurationMs),
    maxSceneDurationMs: Math.max(env.minSceneDurationMs, env.maxSceneDurationMs),
    charsPerSecond: Math.max(1, env.charsPerSecond),
  };
}
