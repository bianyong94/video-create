export type NarrationDensity = "short" | "medium" | "long";
export type ScriptAspectRatio = "portrait" | "landscape";

function getNarrationRules(
  narrationDensity: NarrationDensity,
  sceneCount: number,
  targetDurationMinutes: number
): string[] {
  const totalSeconds = Math.max(30, Math.round(targetDurationMinutes * 60));
  const perSceneSeconds = Math.max(6, Math.round(totalSeconds / Math.max(1, sceneCount)));
  const baseChars = Math.max(30, Math.round(perSceneSeconds * 4.5));

  if (narrationDensity === "long") {
    return [
      "- narration_text should be detailed Chinese voiceover, usually 3-5 sentences per scene.",
      `- narration_text should usually stay within ${Math.round(baseChars * 1.25)}-${Math.round(baseChars * 2)} Chinese characters.`,
      `- Each scene should feel like about ${Math.max(10, perSceneSeconds)}-${Math.max(14, perSceneSeconds + 6)} seconds of narration.`,
    ];
  }

  if (narrationDensity === "short") {
    return [
      "- narration_text should be concise Chinese voiceover, usually 1-2 short sentences per scene.",
      `- narration_text should usually stay within ${Math.round(baseChars * 0.6)}-${Math.round(baseChars * 0.95)} Chinese characters.`,
      `- Each scene should feel like about ${Math.max(5, perSceneSeconds - 3)}-${Math.max(8, perSceneSeconds)} seconds of narration.`,
    ];
  }

  return [
    "- narration_text should be informative Chinese voiceover, usually 2-4 sentences per scene.",
    `- narration_text should usually stay within ${Math.round(baseChars * 0.9)}-${Math.round(baseChars * 1.5)} Chinese characters.`,
    `- Each scene should feel like about ${Math.max(8, perSceneSeconds - 1)}-${Math.max(12, perSceneSeconds + 3)} seconds of narration.`,
  ];
}

export function buildSystemPrompt(
  sceneCount: number,
  narrationDensity: NarrationDensity,
  targetDurationMinutes: number,
  aspectRatio: ScriptAspectRatio = "portrait"
): string {
  return [
    "You are a senior short-video scriptwriter.",
    "Return ONLY strict JSON. No markdown, no extra text.",
    "Output format:",
    `{"scenes":[{"scene_id":1,"narration_text":"...","image_prompt":"...","stock_query":"..."}]}`,
    "Rules:",
    `- Target final video duration should be about ${targetDurationMinutes} minutes.`,
    `- The video should be composed for a ${aspectRatio === "landscape" ? "horizontal 16:9" : "vertical 9:16"} frame.`,
    ...getNarrationRules(narrationDensity, sceneCount, targetDurationMinutes),
    "- Make the narration feel like a coherent mini-story, not isolated bullet points.",
    "- Each scene should begin with a natural transition from the previous scene, such as a causal phrase, temporal progression, or rhetorical bridge.",
    "- Avoid abrupt topic jumps between scenes. The ending of each scene should create a smooth handoff to the next scene.",
    "- The opening scene should hook the viewer with a clear premise or tension.",
    "- Middle scenes should build, compare, contrast, reveal, or escalate the topic.",
    "- The final scene should resolve the narrative cleanly, not stop suddenly.",
    "- narration_text should not be a few short generic sentences; it should have detail, progression, and a bit of creativity while staying on topic.",
    "- image_prompt must be a vivid Chinese visual description for text-to-image.",
    "- stock_query must be 4-10 English keywords optimized for video footage search.",
    "- stock_query should describe generic visual subjects only, and when possible include footage terms such as video, footage, b roll, cinematic, documentary, or animation.",
    "- stock_query should avoid brand names, team names, celebrity names, and text on screen.",
    "- Every scene must use a clearly different shot type. Mix these shot types across scenes: establishing wide shot, medium shot, close-up, over-shoulder, detail close-up.",
    "- image_prompt must describe: subject, action, environment, lighting, camera angle, and shot type.",
    "- image_prompt should target realistic cinematic photography, not illustration.",
    "- image_prompt must explicitly avoid readable text, logos, watermarks, distorted anatomy, malformed hands, duplicated limbs, and warped faces.",
    "- When people appear, keep body proportion natural, fingers complete, facial features symmetric, and expressions realistic.",
    `- Total scenes should be exactly ${sceneCount}.`,
    "- scene_id must be a number starting from 1 and increment by 1.",
  ].join("\n");
}

export function buildUserPrompt(
  topic: string,
  sourceUrl?: string,
  narrationDensity: NarrationDensity = "medium",
  targetDurationMinutes = 2,
  aspectRatio: ScriptAspectRatio = "portrait"
): string {
  const lines = [`主题: ${topic}`];
  if (sourceUrl) {
    lines.push(`参考链接: ${sourceUrl}`);
  }
  lines.push(`文案长度偏好: ${narrationDensity}`);
  lines.push(`目标成片时长: ${targetDurationMinutes} 分钟`);
  lines.push(`画幅: ${aspectRatio === "landscape" ? "横屏" : "竖屏"}`);
  lines.push("请输出分镜脚本 JSON。");
  return lines.join("\n");
}
