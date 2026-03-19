import { getOpenAIConfig } from "../config/env";

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function chatWithOpenAI(messages: OpenAIMessage[]): Promise<string> {
  const config = getOpenAIConfig();
  const url = `${config.openaiBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiChatModel,
      messages,
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  const data = (await response.json()) as OpenAIChatResponse;
  if (!response.ok) {
    const message = data.error?.message ?? "Unknown OpenAI API error";
    throw new Error(`OpenAI API error: ${message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response missing content.");
  }

  return content;
}
