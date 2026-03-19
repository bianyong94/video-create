import { getOllamaConfig } from "../config/env";

export type OllamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

export async function chatWithOllama(
  messages: OllamaMessage[]
): Promise<string> {
  const config = getOllamaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ollamaTimeoutMs);

  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ollamaChatModel,
        stream: false,
        messages,
        options: {
          temperature: 0.2,
        },
      }),
    });

    const data = (await response.json()) as OllamaChatResponse;
    if (!response.ok) {
      throw new Error(data.error ?? "Unknown Ollama API error");
    }

    const content = data.message?.content;
    if (!content) {
      throw new Error("Ollama response missing content.");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}
