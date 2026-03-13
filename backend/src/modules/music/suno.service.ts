import { promises as fs } from "fs";
import path from "path";
import { getSunoConfig } from "../../config/env";
import { buildPublicMediaUrl } from "../../utils/media";

type SunoGenerateResponse = {
  code?: number;
  msg?: string;
  data?: {
    taskId?: string;
  };
};

type SunoRecordInfoResponse = {
  code?: number;
  msg?: string;
  data?: {
    status?: "PENDING" | "SUCCESS" | "FAILED";
    response?: {
      data?: Array<{
        audio_url?: string;
        title?: string;
      }>;
    };
  };
};

type GenerateInput = {
  prompt: string;
  style?: string;
  title?: string;
  instrumental?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadToFile(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download music: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);
}

function getAIMusicDir(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage"), "bgm", "ai");
}

export async function generateAIMusic(input: GenerateInput) {
  const config = getSunoConfig();
  const url = `${config.sunoApiBase}/api/v1/generate`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.sunoApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      style: input.style ?? "",
      title: input.title ?? "BGM",
      customMode: true,
      instrumental: input.instrumental ?? true,
      model: config.sunoModel,
      callBackUrl: config.sunoCallbackUrl,
    }),
  });

  const data = (await response.json()) as SunoGenerateResponse;
  if (!response.ok || !data.data?.taskId) {
    throw new Error(`Suno generate failed: ${JSON.stringify(data)}`);
  }

  const taskId = data.data.taskId;
  const pollUrl = `${config.sunoApiBase}/api/v1/generate/record-info?taskId=${taskId}`;
  const maxAttempts = Math.ceil(config.sunoTimeoutMs / config.sunoPollIntervalMs);
  let audioUrl: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const pollResponse = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${config.sunoApiKey}` },
    });
    const pollData = (await pollResponse.json()) as SunoRecordInfoResponse;
    const status = pollData.data?.status;
    if (status === "SUCCESS") {
      audioUrl = pollData.data?.response?.data?.[0]?.audio_url ?? null;
      break;
    }
    if (status === "FAILED") {
      throw new Error(`Suno generation failed: ${JSON.stringify(pollData)}`);
    }
    await sleep(config.sunoPollIntervalMs);
  }

  if (!audioUrl) {
    throw new Error("Suno generation timed out.");
  }

  const dir = getAIMusicDir();
  await fs.mkdir(dir, { recursive: true });
  const filename = `ai-bgm-${Date.now()}.mp3`;
  const filePath = path.join(dir, filename);
  await downloadToFile(audioUrl, filePath);

  return {
    task_id: taskId,
    bgm_path: filePath,
    bgm_url: buildPublicMediaUrl(filePath),
    source_url: audioUrl,
  };
}
