import { promises as fs } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { getImageConfig, getVideoConfig } from "../../config/env";
import { buildSrt, buildSubtitleLines } from "../../utils/srt";
import type { VideoAssembleInput, VideoAssembleResponse } from "./video.types";
import { pickBgm } from "../music/music.service";

const VIDEO_DIR = "video";

async function ensureVideoDir(): Promise<string> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? "";
  const resolvedBase = baseDir || path.resolve(process.cwd(), "storage");
  const videoDir = path.join(resolvedBase, VIDEO_DIR);
  await fs.mkdir(videoDir, { recursive: true });
  return videoDir;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/,/g, "\\,");
}

async function renderVideo(
  input: VideoAssembleInput,
  outputPath: string
): Promise<boolean> {
  const imageConfig = getImageConfig();
  const videoConfig = getVideoConfig();
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
    const frames = Math.max(1, Math.round(durationSec * fps));
    const zoomExpr =
      index % 2 === 0
        ? "if(eq(on,0),1.0,min(zoom+0.00045,1.1))"
        : "if(eq(on,0),1.1,max(zoom-0.00045,1.0))";
    command
      .input(scene.image_path)
      .inputOptions(["-loop 1", `-t ${durationSec}`]);

    filters.push(
      `[${index}:v]scale=${imageConfig.imageWidth}:${imageConfig.imageHeight}:force_original_aspect_ratio=increase,crop=${imageConfig.imageWidth}:${imageConfig.imageHeight},zoompan=z='${zoomExpr}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${imageConfig.imageWidth}x${imageConfig.imageHeight}:fps=${fps},setsar=1,format=yuv420p[v${index}]`
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
  const fontSize = Math.max(30, Math.round(imageConfig.imageHeight * 0.024));
  const boxBorder = Math.max(12, Math.round(fontSize * 0.45));
  let offsetMs = 0;
  const subtitleLines = buildSubtitleLines(
    input.scenes.map((scene) => {
      const entry = { timestamps: scene.timestamps, offsetMs };
      offsetMs += scene.duration_ms;
      return entry;
    })
  );

  subtitleLines.forEach((line, index: number) => {
    const outputLabel = index === subtitleLines.length - 1 ? "[v_out]" : `[v_sub_${index}]`;
    const start = (line.startMs / 1000).toFixed(3);
    const end = (line.endMs / 1000).toFixed(3);
    const text = escapeDrawtext(line.text);
    filters.push(
      `${subtitleInput}drawtext=text='${text}':fontcolor=white:fontsize=${fontSize}:line_spacing=10:borderw=3:bordercolor=black@0.75:box=1:boxcolor=black@0.35:boxborderw=${boxBorder}:x=(w-text_w)/2:y=h-text_h-140:enable='between(t,${start},${end})'${outputLabel}`
    );
    subtitleInput = outputLabel;
    subtitlesBurned = true;
  });

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
  const videoDir = await ensureVideoDir();
  const baseName = `video-${Date.now()}`;
  const outputPath = path.join(videoDir, `${baseName}.mp4`);
  const srtPath = path.join(videoDir, `${baseName}.srt`);

  let offset = 0;
  const srt = buildSrt(
    input.scenes.map((scene) => {
      const entry = { timestamps: scene.timestamps, offsetMs: offset };
      offset += scene.duration_ms;
      return entry;
    })
  );
  await fs.writeFile(srtPath, srt, "utf-8");

  const subtitlesBurned = await renderVideo(input, outputPath);
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
