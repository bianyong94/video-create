import { randomUUID } from "crypto";
import WebSocket from "ws";
import { getDashScopeConfig } from "../../config/env";

type TtsResult = {
  audioBuffer: Buffer;
  format: string;
  sampleRate: number;
};

type TaskMessage =
  | {
      header: { event: string; task_id: string; task_group?: string };
      payload?: Record<string, unknown>;
    }
  | {
      header: { event: string; task_id: string; error_message?: string };
    };

export async function synthesizeWithDashScope(
  text: string,
  voice?: string
): Promise<TtsResult> {
  const config = getDashScopeConfig();
  const taskId = randomUUID();

  return new Promise<TtsResult>((resolve, reject) => {
    const audioChunks: Buffer[] = [];
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

    ws.on("open", () => {
      const runTask = {
        header: {
          action: "run-task",
          task_id: taskId,
          streaming: "duplex",
        },
        payload: {
          task_group: "audio",
          task: "tts",
          function: "SpeechSynthesizer",
          model: config.dashscopeTtsModel,
          parameters: {
            text_type: "text",
            voice: voice ?? config.dashscopeTtsVoice,
            format: config.dashscopeTtsFormat,
            sample_rate: config.dashscopeTtsSampleRate,
          },
          input: {},
        },
      };
      ws.send(JSON.stringify(runTask));
    });

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        audioChunks.push(Buffer.from(data as Buffer));
        return;
      }

      const textData = data.toString();
      let message: TaskMessage;
      try {
        message = JSON.parse(textData) as TaskMessage;
      } catch (error) {
        cleanup();
        reject(new Error("DashScope TTS returned invalid JSON message."));
        return;
      }

      const event = message.header.event;
      if (event === "task-started") {
        const continueTask = {
          header: {
            action: "continue-task",
            task_id: taskId,
            streaming: "duplex",
          },
          payload: {
            input: {
              text,
            },
          },
        };
        const finishTask = {
          header: {
            action: "finish-task",
            task_id: taskId,
            streaming: "duplex",
          },
          payload: { input: {} },
        };
        ws.send(JSON.stringify(continueTask));
        ws.send(JSON.stringify(finishTask));
        return;
      }

      if (event === "task-finished") {
        cleanup();
        resolve({
          audioBuffer: Buffer.concat(audioChunks),
          format: config.dashscopeTtsFormat,
          sampleRate: config.dashscopeTtsSampleRate,
        });
        return;
      }

      if (event === "task-failed") {
        cleanup();
        const errorMessage =
          "error_message" in message.header
            ? message.header.error_message
            : undefined;
        reject(new Error(errorMessage ?? "DashScope TTS failed."));
      }
    });

    ws.on("error", (error) => {
      cleanup();
      reject(error);
    });
  });
}
