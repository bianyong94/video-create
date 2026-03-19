import { promises as fs } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { getImageConfig, getVideoConfig } from "../../config/env";
import { getAspectDimensions, normalizeAspectRatio } from "../../utils/aspectRatio";
import { buildSrt, buildSubtitleLines } from "../../utils/srt";
import type { VideoAssembleInput, VideoAssembleResponse } from "./video.types";
import { pickBgm } from "../music/music.service";

const VIDEO_DIR = "video";
const TMP_DIR = "tmp";

async function ensureVideoDirs(): Promise<{ videoDir: string; tmpDir: string }> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? "";
  const resolvedBase = baseDir || path.resolve(process.cwd(), "storage");
  const videoDir = path.join(resolvedBase, VIDEO_DIR);
  const tmpDir = path.join(resolvedBase, TMP_DIR);
  await fs.mkdir(videoDir, { recursive: true });
  await fs.mkdir(tmpDir, { recursive: true });
  return { videoDir, tmpDir };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapSubtitleText(text: string, maxCharsPerLine = 18): string[] {
  const normalized = text.replace(/\s+/g, "");
  if (!normalized) return [text];
  const lines: string[] = [];
  for (let index = 0; index < normalized.length; index += maxCharsPerLine) {
    lines.push(normalized.slice(index, index + maxCharsPerLine));
  }
  return lines.slice(0, 2);
}

async function createSubtitleOverlay(
  text: string,
  width: number,
  height: number,
  outputPath: string
): Promise<void> {
  const lines = wrapSubtitleText(text);
  const fontSize = Math.max(34, Math.round(height * 0.026));
  const lineHeight = Math.round(fontSize * 1.35);
  const textBlockHeight = lineHeight * lines.length;
  const boxHeight = textBlockHeight + 48;
  const boxWidth = Math.round(width * 0.84);
  const boxX = Math.round((width - boxWidth) / 2);
  const boxY = Math.round(height - boxHeight - height * 0.08);
  const centerY = boxY + boxHeight / 2;
  const firstLineY = centerY - ((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map((line, index) => {
      const y = firstLineY + index * lineHeight;
      return `<tspan x="50%" y="${y}" dominant-baseline="middle">${escapeXml(line)}</tspan>`;
    })
    .join("");
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="28" fill="rgba(0,0,0,0.38)" />
      <text
        x="50%"
        y="${centerY}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="${fontSize}"
        font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
        font-weight="700"
        fill="#FFFFFF"
      >${tspans}</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

async function renderVideo(
  input: VideoAssembleInput,
  outputPath: string,
  subtitleOverlayDir: string,
  disableSubtitles = false
): Promise<boolean> {
  const imageConfig = getImageConfig();
  const videoConfig = getVideoConfig();
  const aspectRatio = normalizeAspectRatio(input.aspect_ratio);
  const { width: videoWidth, height: videoHeight } = getAspectDimensions(
    aspectRatio,
    imageConfig.imageWidth,
    imageConfig.imageHeight
  );
  const fps = videoConfig.videoFps;
  const totalDurationSec =
    input.scenes.reduce((acc: number, scene) => acc + scene.duration_ms, 0) / 1000;

  const command = ffmpeg();
  const filters: string[] = [];

  input.scenes.forEach((scene, index: number) => {
    const durationSec = Math.max(
      videoConfig.minSceneDurationMs / 1000,
      scene.duration_ms / 1000
    );
    const fadeDuration = Math.min(0.18, Math.max(0.08, durationSec * 0.08));
    const fadeOutStart = Math.max(0, durationSec - fadeDuration);

    if (scene.video_path) {
      command
        .input(scene.video_path)
        .inputOptions(["-stream_loop -1", `-t ${durationSec}`]);
    } else if (scene.image_path) {
      command
        .input(scene.image_path)
        .inputOptions(["-loop 1", `-t ${durationSec}`]);
    } else {
      throw new Error(`Scene ${scene.scene_id} is missing visual media.`);
    }

    filters.push(
      `[${index}:v]scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight},fps=${fps},trim=duration=${durationSec},setpts=PTS-STARTPTS,fade=t=in:st=0:d=${fadeDuration},fade=t=out:st=${fadeOutStart}:d=${fadeDuration},setsar=1,format=yuv420p[v${index}]`
    );
  });

  const videoLabels = input.scenes.map((_, idx: number) => `[v${idx}]`).join("");
  filters.push(`${videoLabels}concat=n=${input.scenes.length}:v=1:a=0[v_base]`);

  const audioStartIndex = input.scenes.length;
  input.scenes.forEach((scene) => {
    command.input(scene.audio_path);
  });
  const audioLabels = input.scenes
    .map((_, idx: number) => `[${audioStartIndex + idx}:a]`)
    .join("");
  filters.push(`${audioLabels}concat=n=${input.scenes.length}:v=0:a=1[a_voice]`);

  let bgmPath: string | null = null;
  if (input.bgm_enabled === false) {
    bgmPath = null;
  } else if (input.bgm_path) {
    bgmPath = input.bgm_path;
  } else {
    bgmPath = await pickBgm(input.bgm_style);
  }

  let audioOutLabel = "[a_voice]";
  if (bgmPath) {
    const bgmIndex = audioStartIndex + input.scenes.length;
    const volume = typeof input.bgm_volume === "number" ? input.bgm_volume : 0.2;
    command
      .input(bgmPath)
      .inputOptions(["-stream_loop -1", `-t ${totalDurationSec}`]);
    filters.push(
      `[${bgmIndex}:a]volume=${volume},atrim=0:${totalDurationSec}[a_bgm]`
    );
    filters.push(
      `[a_voice][a_bgm]amix=inputs=2:duration=first:dropout_transition=2[a_mix]`
    );
    audioOutLabel = "[a_mix]";
  }

  let subtitleInput = "[v_base]";
  let subtitlesBurned = false;
  if (!disableSubtitles) {
    let offsetMs = 0;
    const subtitleLines = buildSubtitleLines(
      input.scenes.map((scene) => {
        const entry = { timestamps: scene.timestamps, offsetMs };
        offsetMs += scene.duration_ms;
        return entry;
      })
    );
    const subtitleInputStartIndex =
      input.scenes.length * 2 + (bgmPath ? 1 : 0);
    subtitleLines.forEach((line, index: number) => {
      const overlayPath = path.join(subtitleOverlayDir, `subtitle-${index}.png`);
      command
        .input(overlayPath)
        .inputOptions(["-loop 1", `-t ${totalDurationSec}`]);
    });
    for (const [index, line] of subtitleLines.entries()) {
      const overlayPath = path.join(subtitleOverlayDir, `subtitle-${index}.png`);
      await createSubtitleOverlay(
        line.text,
        videoWidth,
        videoHeight,
        overlayPath
      );
      const outputLabel = index === subtitleLines.length - 1 ? "[v_out]" : `[v_sub_${index}]`;
      const start = (line.startMs / 1000).toFixed(3);
      const end = (line.endMs / 1000).toFixed(3);
      filters.push(
        `${subtitleInput}[${subtitleInputStartIndex + index}:v]overlay=0:0:enable='between(t,${start},${end})'${outputLabel}`
      );
      subtitleInput = outputLabel;
      subtitlesBurned = true;
    }
  }

  const videoOutLabel = subtitlesBurned ? "[v_out]" : "[v_base]";

  await new Promise<void>((resolve, reject) => {
    command
      .complexFilter(filters)
      .outputOptions([
        `-map ${videoOutLabel}`,
        `-map ${audioOutLabel}`,
        `-r ${fps}`,
        "-c:v libx264",
        "-preset veryfast",
        "-crf 24",
        "-pix_fmt yuv420p",
        "-c:a aac",
        "-movflags +faststart",
        "-shortest",
        "-y",
      ])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });

  return subtitlesBurned;
}

export async function assembleVideo(
  input: VideoAssembleInput
): Promise<VideoAssembleResponse> {
  const { videoDir, tmpDir } = await ensureVideoDirs();
  const baseName = `video-${Date.now()}`;
  const outputPath = path.join(videoDir, `${baseName}.mp4`);
  const srtPath = path.join(videoDir, `${baseName}.srt`);
  const subtitleOverlayDir = path.join(tmpDir, `${baseName}-subtitles`);
  await fs.mkdir(subtitleOverlayDir, { recursive: true });

  let offset = 0;
  const srt = buildSrt(
    input.scenes.map((scene) => {
      const entry = { timestamps: scene.timestamps, offsetMs: offset };
      offset += scene.duration_ms;
      return entry;
    })
  );
  await fs.writeFile(srtPath, srt, "utf-8");

  let subtitlesBurned = false;
  try {
    try {
      subtitlesBurned = await renderVideo(
        input,
        outputPath,
        subtitleOverlayDir,
        false
      );
    } catch {
      subtitlesBurned = false;
      await renderVideo(input, outputPath, subtitleOverlayDir, true);
    }
  } finally {
    await fs.rm(subtitleOverlayDir, { recursive: true, force: true });
  }
  const durationMs = input.scenes.reduce(
    (acc: number, scene) => acc + scene.duration_ms,
    0
  );

  return {
    video_path: outputPath,
    srt_path: srtPath,
    duration_ms: durationMs,
    subtitles_burned: subtitlesBurned,
  };
}
