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
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<string> {
  if (provider === "openai") {
    return chatWithOpenAI(messages);
  }
  if (provider === "ollama") {
    return chatWithOllama(messages);
  }
  return chatWithQwen(messages);
}

export async function generateScript(
  input: ScriptGenerateInput
): Promise<ScriptPayload> {
  const { scriptProvider } = getScriptConfig();
  const sceneCount = input.sceneCount ?? DEFAULT_SCENE_COUNT;
  const narrationDensity = input.narrationDensity ?? "medium";
  const aspectRatio = input.aspectRatio ?? "portrait";
  const targetDurationMinutes = Math.max(
    0.5,
    Math.min(30, input.targetDurationMinutes ?? DEFAULT_TARGET_DURATION_MINUTES)
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
          const raw = await chatWithProvider(provider, messages);
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
