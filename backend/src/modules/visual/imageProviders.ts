import { getImageConfig } from "../../config/env";

type ImageResult = {
  buffer: Buffer;
  ext: string;
};

type QwenResponse = {
  output?: {
    task_id?: string;
    task_status?: string;
    code?: string;
    message?: string;
    results?: Array<{
      url?: string;
      image_url?: string;
      base64?: string;
    }>;
  };
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  images?: Array<{
    url?: string;
    base64?: string;
  }>;
};

type CogViewResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
};

export class ImageProviderError extends Error {
  code?: string;
  provider: "qwen" | "cogview";

  constructor(provider: "qwen" | "cogview", code: string | undefined, message: string) {
    super(message);
    this.code = code;
    this.provider = provider;
  }
}

function guessExt(contentType?: string): string {
  if (!contentType) return "png";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

async function fetchImage(url: string): Promise<ImageResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? undefined;
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, ext: guessExt(contentType) };
}

function decodeBase64(data: string): ImageResult {
  const cleaned = data.replace(/^data:\w+\/\w+;base64,/, "");
  return { buffer: Buffer.from(cleaned, "base64"), ext: "png" };
}

function pickQwenSize(width: number, height: number): string {
  const allowed = ["1024*1024", "720*1280", "1280*720", "768*1152"];
  const portrait = height >= width;
  if (width === height) return "1024*1024";
  if (portrait) {
    return height / width >= 1.5 ? "720*1280" : "768*1152";
  }
  return "1280*720";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollQwenTask(taskId: string): Promise<QwenResponse> {
  const config = getImageConfig();
  const taskUrl = `${config.qwenApiBase}/api/v1/tasks/${taskId}`;
  const timeoutMs = Math.max(30000, config.qwenTaskTimeoutMs);
  const intervalMs = Math.max(800, config.qwenTaskPollIntervalMs);
  const maxAttempts = Math.ceil(timeoutMs / intervalMs);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(taskUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.qwenApiKey}`,
      },
    });
    const data = (await response.json()) as QwenResponse;
    const status = data.output?.task_status;
    if (status === "SUCCEEDED") {
      return data;
    }
    if (status === "FAILED") {
      const code = data.output?.code ?? "FAILED";
      const message = data.output?.message ?? "Qwen image task failed";
      throw new ImageProviderError("qwen", code, `Qwen image task failed: ${code} ${message}`);
    }
    await sleep(intervalMs);
  }
  throw new Error("Qwen image task timeout.");
}

export async function generateImage(
  prompt: string,
  providerOverride?: "qwen" | "cogview"
): Promise<ImageResult> {
  const config = getImageConfig();
  const provider = providerOverride ?? config.imageProvider;

  if (provider === "qwen") {
    if (!prompt || prompt.trim() === "") {
      throw new Error("Image prompt is empty.");
    }
    const url = `${config.qwenApiBase}${config.qwenApiPath}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.qwenApiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: config.qwenModel,
        input: {
          prompt,
        },
        parameters: {
          n: 1,
          size: pickQwenSize(config.imageWidth, config.imageHeight),
        },
      }),
    });
    const data = (await response.json()) as QwenResponse;

    if (!response.ok) {
      throw new ImageProviderError(
        "qwen",
        data.output?.code ?? data.code,
        `Qwen image API error: ${JSON.stringify(data)}`
      );
    }

    const syncCandidate =
      data.output?.results?.[0]?.url ??
      data.output?.results?.[0]?.image_url ??
      data.images?.[0]?.url ??
      data.data?.[0]?.url;
    const syncBase64 =
      data.output?.results?.[0]?.base64 ??
      data.images?.[0]?.base64 ??
      data.data?.[0]?.b64_json;
    if (syncCandidate) {
      return fetchImage(syncCandidate);
    }
    if (syncBase64) {
      return decodeBase64(syncBase64);
    }

    const taskId = data.output?.task_id;
    if (!taskId) {
      throw new ImageProviderError(
        "qwen",
        "MissingTaskId",
        `Qwen image API missing task_id: ${JSON.stringify(data)}`
      );
    }

    const result = await pollQwenTask(taskId);
    const candidate =
      result.output?.results?.[0]?.url ??
      result.output?.results?.[0]?.image_url ??
      result.images?.[0]?.url ??
      result.data?.[0]?.url;
    const base64 =
      result.output?.results?.[0]?.base64 ??
      result.images?.[0]?.base64 ??
      result.data?.[0]?.b64_json;

    if (candidate) {
      return fetchImage(candidate);
    }
    if (base64) {
      return decodeBase64(base64);
    }
    throw new Error("Qwen image API returned no image.");
  }

  const url = `${config.cogviewApiBase}${config.cogviewApiPath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.cogviewApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.cogviewModel,
      prompt,
      n: 1,
      size: `${config.imageWidth}x${config.imageHeight}`,
    }),
  });
  const data = (await response.json()) as CogViewResponse;
  const candidate = data.data?.[0]?.url;
  const base64 = data.data?.[0]?.b64_json;

  if (!response.ok) {
    throw new ImageProviderError(
      "cogview",
      data?.error?.code ?? "HttpError",
      `CogView image API error: ${JSON.stringify(data)}`
    );
  }

  if (candidate) {
    return fetchImage(candidate);
  }
  if (base64) {
    return decodeBase64(base64);
  }
  throw new Error("CogView image API returned no image.");
}
