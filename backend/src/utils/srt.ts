import type { WordTimestamp } from "../modules/audio/audio.types";

type SubtitleLine = {
  startMs: number;
  endMs: number;
  text: string;
};

function formatTime(ms: number): string {
  const total = Math.max(0, ms);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const milliseconds = Math.floor(total % 1000);
  const pad = (value: number, width: number) => value.toString().padStart(width, "0");
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
}

function splitToSubtitles(words: WordTimestamp[], offsetMs: number): SubtitleLine[] {
  const subtitles: SubtitleLine[] = [];
  let buffer: WordTimestamp[] = [];
  let lineStart = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const start = buffer[0].begin_ms + offsetMs;
    const end = buffer[buffer.length - 1].end_ms + offsetMs;
    const text = buffer.map((w) => w.text).join("");
    subtitles.push({ startMs: start, endMs: end, text });
    buffer = [];
  };

  for (const word of words) {
    if (buffer.length === 0) {
      lineStart = word.begin_ms;
    }
    buffer.push(word);

    const duration = word.end_ms - lineStart;
    const tooLong = duration > 3000;
    const tooMany = buffer.length >= 12;
    const ends = /[。！？!?]/.test(word.text);

    if (tooLong || tooMany || ends) {
      flush();
    }
  }

  flush();
  return subtitles;
}

export function buildSubtitleLines(
  scenes: Array<{ timestamps: WordTimestamp[]; offsetMs: number }>
): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  scenes.forEach((scene) => {
    lines.push(...splitToSubtitles(scene.timestamps, scene.offsetMs));
  });
  return lines;
}

export function buildSrt(
  scenes: Array<{ timestamps: WordTimestamp[]; offsetMs: number }>
): string {
  const lines = buildSubtitleLines(scenes);

  return lines
    .map((line, index) => {
      const start = formatTime(line.startMs);
      const end = formatTime(line.endMs);
      return `${index + 1}\n${start} --> ${end}\n${line.text}\n`;
    })
    .join("\n");
}
