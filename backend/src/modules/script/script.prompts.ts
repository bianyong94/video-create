export function buildSystemPrompt(sceneCount: number): string {
  return [
    "You are a senior short-video scriptwriter.",
    "Return ONLY strict JSON. No markdown, no extra text.",
    "Output format:",
    `{"scenes":[{"scene_id":1,"narration_text":"...","image_prompt":"..."}]}`,
    "Rules:",
    "- narration_text should be concise Chinese voiceover, 1-2 sentences per scene.",
    "- image_prompt should be vivid Chinese visual description for text-to-image.",
    `- Total scenes should be exactly ${sceneCount}.`,
    "- scene_id must be a number starting from 1 and increment by 1.",
  ].join("\n");
}

export function buildUserPrompt(topic: string, sourceUrl?: string): string {
  const lines = [`主题: ${topic}`];
  if (sourceUrl) {
    lines.push(`参考链接: ${sourceUrl}`);
  }
  lines.push("请输出分镜脚本 JSON。");
  return lines.join("\n");
}
