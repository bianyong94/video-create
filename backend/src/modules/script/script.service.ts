import { chatWithQwen } from "../../services/qwenClient";
import { chatWithOpenAI } from "../../services/openaiClient";
import { chatWithOllama } from "../../services/ollamaClient";
import { env, getScriptConfig } from "../../config/env";
import { parseJsonFromModel, normalizeScriptPayload, ScriptPayload } from "../../utils/json";
import { withRetry } from "../../utils/retry";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type NarrationDensity,
  type ScriptAspectRatio,
} from "./script.prompts";

export type ScriptGenerateInput = {
  topic: string;
  sourceUrl?: string;
  sceneCount?: number;
  narrationDensity?: NarrationDensity;
  targetDurationMinutes?: number;
  aspectRatio?: ScriptAspectRatio;
};

const DEFAULT_SCENE_COUNT = 6;
const DEFAULT_TARGET_DURATION_MINUTES = 2;

type ScriptProvider = "qwen" | "openai" | "ollama";

type ScriptChatOptions = {
  maxTokens: number;
  temperature: number;
};

function deriveSceneCount(targetDurationMinutes: number, requestedSceneCount?: number): number {
  if (typeof requestedSceneCount === "number" && Number.isFinite(requestedSceneCount)) {
    return Math.max(3, Math.min(120, Math.trunc(requestedSceneCount)));
  }
  const estimated = Math.round((targetDurationMinutes * 60) / 12);
  return Math.max(6, Math.min(120, estimated));
}

function deriveScriptChatOptions(
  sceneCount: number,
  targetDurationMinutes: number,
  narrationDensity: NarrationDensity
): ScriptChatOptions {
  const densityFactor = narrationDensity === "long" ? 1.35 : narrationDensity === "short" ? 0.8 : 1;
  const estimatedTokens = Math.round(sceneCount * 220 * densityFactor + targetDurationMinutes * 140);
  return {
    maxTokens: Math.max(2500, Math.min(12000, estimatedTokens)),
    temperature: narrationDensity === "long" ? 0.78 : 0.68,
  };
}

function getScriptProviderOrder(preferred: ScriptProvider): ScriptProvider[] {
  const providers: ScriptProvider[] = [preferred];

  if (preferred !== "qwen" && env.qwenChatApiKey) {
    providers.push("qwen");
  }
  if (preferred !== "openai" && env.openaiApiKey) {
    providers.push("openai");
  }
  if (preferred !== "ollama" && env.ollamaBaseUrl) {
    providers.push("ollama");
  }

  return Array.from(new Set(providers));
}

function shouldTryNextScriptProvider(
  provider: ScriptProvider,
  error: unknown
): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (provider === "ollama") {
    return (
      message.includes("fetch failed") ||
      message.includes("econnrefused") ||
      message.includes("aborted") ||
      message.includes("missing required env vars")
    );
  }

  if (provider === "openai" || provider === "qwen") {
    return (
      message.includes("missing required env vars") ||
      message.includes("api error") ||
      message.includes("fetch failed")
    );
  }

  return false;
}

async function chatWithProvider(
  provider: ScriptProvider,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: ScriptChatOptions
): Promise<string> {
  if (provider === "openai") {
    return chatWithOpenAI(messages, options);
  }
  if (provider === "ollama") {
    return chatWithOllama(messages, options);
  }
  return chatWithQwen(messages, options);
}

export async function generateScript(
  input: ScriptGenerateInput
): Promise<ScriptPayload> {
  const { scriptProvider } = getScriptConfig();
  const narrationDensity = input.narrationDensity ?? "medium";
  const aspectRatio = input.aspectRatio ?? "portrait";
  const targetDurationMinutes = Math.max(
    0.5,
    Math.min(60, input.targetDurationMinutes ?? DEFAULT_TARGET_DURATION_MINUTES)
  );
  const sceneCount = deriveSceneCount(targetDurationMinutes, input.sceneCount);
  const chatOptions = deriveScriptChatOptions(
    sceneCount,
    targetDurationMinutes,
    narrationDensity
  );

  const baseMessages = [
    {
      role: "system" as const,
      content: buildSystemPrompt(
        sceneCount,
        narrationDensity,
        targetDurationMinutes,
        aspectRatio
      ),
    },
    {
      role: "user" as const,
      content: buildUserPrompt(
        input.topic,
        input.sourceUrl,
        narrationDensity,
        targetDurationMinutes,
        aspectRatio
      ),
    },
  ];

  return withRetry(
    async (attempt) => {
      const providers = getScriptProviderOrder(scriptProvider);
      const messages = [...baseMessages];
      if (attempt > 1) {
        messages.push({
          role: "system" as const,
          content:
            "Your previous response was invalid. Return ONLY valid JSON matching the specified schema.",
        });
      }

      let lastError: unknown = null;
      for (const provider of providers) {
        try {
          const raw = await chatWithProvider(provider, messages, chatOptions);
          const parsed = parseJsonFromModel(raw);
          return normalizeScriptPayload(parsed, sceneCount);
        } catch (error) {
          lastError = error;
          if (!shouldTryNextScriptProvider(provider, error)) {
            break;
          }
        }
      }

      throw lastError instanceof Error ? lastError : new Error("Script generation failed.");
    },
    { retries: 2, delayMs: 800 }
  );
}
