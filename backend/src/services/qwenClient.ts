import { getQwenChatConfig } from "../config/env";

export type QwenMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type QwenChatOptions = {
  maxTokens?: number;
  temperature?: number;
};

type QwenResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function chatWithQwen(
  messages: QwenMessage[],
  options?: QwenChatOptions
): Promise<string> {
  const config = getQwenChatConfig();
  const url = `${config.qwenChatBaseUrl}${config.qwenChatPath}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.qwenChatApiKey}`,
    },
    body: JSON.stringify({
      model: config.qwenChatModel,
      messages,
      temperature: options?.temperature ?? config.qwenChatTemperature,
      max_tokens: options?.maxTokens ?? config.qwenChatMaxTokens,
    }),
  });

  const data = (await response.json()) as QwenResponse;

  if (!response.ok) {
    const message = data.error?.message ?? "Unknown Qwen API error";
    throw new Error(`Qwen API error: ${message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Qwen response missing content.");
  }

  return content;
}
