import ffmpeg from "fluent-ffmpeg";

export async function probeAudioDurationMs(filePath: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const duration = data.format?.duration;
      if (typeof duration === "number" && Number.isFinite(duration)) {
        resolve(Math.round(duration * 1000));
        return;
      }
      resolve(null);
    });
  });
}
