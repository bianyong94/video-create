import { env, getTtsConfig } from "../../config/env";
import { synthesizeWithDashScope } from "./dashscopeTts";
import { synthesizeWithEdgeTts } from "./edgeTts";

type TtsResult = {
  audioBuffer: Buffer;
  format: string;
  sampleRate: number;
  voiceUsed: string;
};

async function synthesizeWithProvider(
  provider: "dashscope" | "edge",
  text: string,
  voice?: string
): Promise<TtsResult> {
  if (provider === "edge") {
    return synthesizeWithEdgeTts(text, voice);
  }

  const result = await synthesizeWithDashScope(text, voice);
  return {
    ...result,
    voiceUsed: voice ?? env.dashscopeTtsVoice,
  };
}

export async function synthesizeSpeech(
  text: string,
  voice?: string
): Promise<TtsResult> {
  const { ttsProvider } = getTtsConfig();

  if (ttsProvider === "edge") {
    try {
      return await synthesizeWithProvider("edge", text, voice);
    } catch (error) {
      if (env.dashscopeApiKey) {
        return synthesizeWithProvider("dashscope", text, voice);
      }
      throw error;
    }
  }

  try {
    return await synthesizeWithProvider("dashscope", text, voice);
  } catch (error) {
    try {
      return await synthesizeWithProvider("edge", text, voice);
    } catch {
      throw error;
    }
  }
}
