import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { getTtsConfig } from "../../config/env";

type TtsResult = {
  audioBuffer: Buffer;
  format: string;
  sampleRate: number;
  voiceUsed: string;
};

function resolveScriptPath(scriptPath: string): string {
  return path.isAbsolute(scriptPath)
    ? scriptPath
    : path.resolve(process.cwd(), scriptPath);
}

export async function synthesizeWithEdgeTts(
  text: string,
  voice?: string
): Promise<TtsResult> {
  const config = getTtsConfig();
  const voiceUsed = voice?.trim() || config.edgeTtsVoice;
  const scriptPath = resolveScriptPath(config.edgeTtsScriptPath);
  const outputPath = path.join(os.tmpdir(), `edge-tts-${Date.now()}-${Math.random()}.mp3`);

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        config.edgeTtsPythonBin,
        [
          scriptPath,
          "--text",
          text,
          "--voice",
          voiceUsed,
          "--output",
          outputPath,
        ],
        { maxBuffer: 1024 * 1024 * 4 },
        (error, execStdout, execStderr) => {
          if (error) {
            reject(
              new Error(
                execStderr?.trim() ||
                  execStdout?.trim() ||
                  `edge-tts failed: ${error.message}`
              )
            );
            return;
          }
          resolve(execStdout.trim());
        }
      );
    });

    const metadata = JSON.parse(stdout) as { format?: string; sample_rate?: number };
    const audioBuffer = await fs.readFile(outputPath);
    return {
      audioBuffer,
      format: metadata.format ?? "mp3",
      sampleRate: metadata.sample_rate ?? 24000,
      voiceUsed,
    };
  } finally {
    await fs.rm(outputPath, { force: true });
  }
}
