import { chatWithQwen } from "../../services/qwenClient";
import { parseJsonFromModel, normalizeScriptPayload, ScriptPayload } from "../../utils/json";
import { withRetry } from "../../utils/retry";
import { buildSystemPrompt, buildUserPrompt } from "./script.prompts";

export type ScriptGenerateInput = {
  topic: string;
  sourceUrl?: string;
  sceneCount?: number;
};

const DEFAULT_SCENE_COUNT = 6;

export async function generateScript(
  input: ScriptGenerateInput
): Promise<ScriptPayload> {
  const sceneCount = input.sceneCount ?? DEFAULT_SCENE_COUNT;

  const baseMessages = [
    { role: "system" as const, content: buildSystemPrompt(sceneCount) },
    { role: "user" as const, content: buildUserPrompt(input.topic, input.sourceUrl) },
  ];

  return withRetry(
    async (attempt) => {
      const messages = [...baseMessages];
      if (attempt > 1) {
        messages.push({
          role: "system" as const,
          content:
            "Your previous response was invalid. Return ONLY valid JSON matching the specified schema.",
        });
      }

      const raw = await chatWithQwen(messages);
      const parsed = parseJsonFromModel(raw);
      return normalizeScriptPayload(parsed);
    },
    { retries: 2, delayMs: 800 }
  );
}
