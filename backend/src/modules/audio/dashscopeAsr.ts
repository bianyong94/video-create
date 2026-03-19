import { createReadStream } from "fs";
import { randomUUID } from "crypto";
import WebSocket from "ws";
import { getDashScopeConfig } from "../../config/env";
import type { WordTimestamp } from "./audio.types";

type AsrResult = {
  timestamps: WordTimestamp[];
  durationMs: number;
  recognizedText: string;
};

type AsrMessage = {
  header: {
    event: string;
    task_id: string;
    error_message?: string;
  };
  payload?: {
    output?: {
      sentence?: {
        begin_time?: number;
        end_time?: number;
        text?: string;
        words?: Array<{
          begin_time?: number;
          end_time?: number;
          text?: string;
        }>;
      };
      sentence_end?: boolean;
    };
  };
};

export async function recognizeWithDashScope(
  audioPath: string
): Promise<AsrResult> {
  const config = getDashScopeConfig();
  const taskId = randomUUID();

  return new Promise<AsrResult>((resolve, reject) => {
    const timestamps: WordTimestamp[] = [];
    const recognizedParts: string[] = [];
    let durationMs = 0;
    const ws = new WebSocket(config.dashscopeWsUrl, {
      headers: {
        Authorization: `bearer ${config.dashscopeApiKey}`,
      },
    });

    const cleanup = () => {
      ws.removeAllListeners();
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };

    ws.on("open", async () => {
      const runTask = {
        header: {
          action: "run-task",
          task_id: taskId,
          streaming: "duplex",
        },
        payload: {
          task_group: "audio",
          task: "asr",
          function: "recognition",
          model: config.dashscopeAsrModel,
          parameters: {
            format: config.dashscopeAsrFormat,
            sample_rate: config.dashscopeAsrSampleRate,
            enable_intermediate_result: false,
            punctuation_prediction: true,
          },
          input: {},
        },
      };
      ws.send(JSON.stringify(runTask));
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        return;
      }

      let message: AsrMessage;
      try {
        message = JSON.parse(data.toString()) as AsrMessage;
      } catch (error) {
        cleanup();
        reject(new Error("DashScope ASR returned invalid JSON message."));
        return;
      }

      const event = message.header.event;
      if (event === "task-started") {
        const readStream = createReadStream(audioPath, { highWaterMark: 3200 });
        readStream.on("data", (chunk) => {
          ws.send(chunk);
          readStream.pause();
          setTimeout(() => readStream.resume(), 100);
        });
        readStream.on("end", () => {
          const finishTask = {
            header: {
              action: "finish-task",
              task_id: taskId,
              streaming: "duplex",
            },
            payload: { input: {} },
          };
          ws.send(JSON.stringify(finishTask));
        });
        readStream.on("error", (err) => {
          cleanup();
          reject(err);
        });
        return;
      }

      if (event === "result-generated") {
        const sentence = message.payload?.output?.sentence;
        const sentenceEnd = message.payload?.output?.sentence_end;
        if (sentenceEnd && typeof sentence?.text === "string" && sentence.text.trim()) {
          recognizedParts.push(sentence.text.trim());
        }
        if (sentenceEnd && sentence?.words) {
          sentence.words.forEach((word) => {
            if (
              typeof word.text === "string" &&
              typeof word.begin_time === "number" &&
              typeof word.end_time === "number"
            ) {
              timestamps.push({
                text: word.text,
                begin_ms: word.begin_time,
                end_ms: word.end_time,
              });
              durationMs = Math.max(durationMs, word.end_time);
            }
          });
        }
        return;
      }

      if (event === "task-finished") {
        cleanup();
        resolve({
          timestamps,
          durationMs,
          recognizedText: recognizedParts.join(""),
        });
        return;
      }

      if (event === "task-failed") {
        cleanup();
        reject(new Error(message.header.error_message ?? "DashScope ASR failed."));
      }
    });

    ws.on("error", (error) => {
      cleanup();
      reject(error);
    });
  });
}
