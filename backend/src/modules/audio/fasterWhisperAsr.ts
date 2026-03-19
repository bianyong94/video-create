import { execFile } from "child_process";
import path from "path";
import { getAudioConfig } from "../../config/env";
import type { WordTimestamp } from "./audio.types";

type FasterWhisperResult = {
  duration_ms: number;
  recognized_text: string;
  timestamps: WordTimestamp[];
};

export type AsrResult = {
  durationMs: number;
  recognizedText: string;
  timestamps: WordTimestamp[];
};

function resolveScriptPath(scriptPath: string): string {
  return path.isAbsolute(scriptPath)
    ? scriptPath
    : path.resolve(process.cwd(), scriptPath);
}

export async function recognizeWithFasterWhisper(
  audioPath: string
): Promise<AsrResult> {
  const config = getAudioConfig();
  const scriptPath = resolveScriptPath(config.fasterWhisperScriptPath);

  return new Promise<AsrResult>((resolve, reject) => {
    execFile(
      config.fasterWhisperPythonBin,
      [
        scriptPath,
        audioPath,
        "--model",
        config.fasterWhisperModel,
        "--compute-type",
        config.fasterWhisperComputeType,
        "--language",
        config.fasterWhisperLanguage,
        "--beam-size",
        String(config.fasterWhisperBeamSize),
        "--word-timestamps",
        String(config.fasterWhisperWordTimestamps),
      ],
      { maxBuffer: 1024 * 1024 * 8 },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              stderr?.trim() ||
                stdout?.trim() ||
                `faster-whisper failed: ${error.message}`
            )
          );
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim()) as FasterWhisperResult;
          resolve({
            durationMs: parsed.duration_ms,
            recognizedText: parsed.recognized_text,
            timestamps: parsed.timestamps,
          });
        } catch (parseError) {
          reject(
            new Error(
              `Failed to parse faster-whisper output: ${
                parseError instanceof Error ? parseError.message : "unknown error"
              }`
            )
          );
        }
      }
    );
  });
}
