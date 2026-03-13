import { promises as fs } from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { buildSrt } from "../../utils/srt";
import type { VideoAssembleInput, VideoAssembleResponse } from "./video.types";
import { pickBgm } from "../music/music.service";

const VIDEO_DIR = "video";
const TMP_DIR = "tmp";

async function ensureDirs(): Promise<{ videoDir: string; tmpDir: string }> {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? "";
  const resolvedBase = baseDir || path.resolve(process.cwd(), "storage");
  const videoDir = path.join(resolvedBase, VIDEO_DIR);
  const tmpDir = path.join(resolvedBase, TMP_DIR);
  await fs.mkdir(videoDir, { recursive: true });
  await fs.mkdir(tmpDir, { recursive: true });
  return { videoDir, tmpDir };
}

function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

async function renderSegments(
  input: VideoAssembleInput,
  outputPath: string
): Promise<void> {
  const imageWidth = Number(process.env.IMAGE_WIDTH ?? "1080");
  const imageHeight = Number(process.env.IMAGE_HEIGHT ?? "1920");
  const fps = 30;
  const totalDurationSec =
    input.scenes.reduce((acc, scene) => acc + scene.duration_ms, 0) / 1000;

  const command = ffmpeg();
  const filters: string[] = [];

  input.scenes.forEach((scene, index) => {
    const durationSec = Math.max(0.5, scene.duration_ms / 1000);
    const frames = Math.max(1, Math.round(durationSec * fps));
    const zoomExpr =
      index % 2 === 0
        ? "if(eq(on,0),1.0,min(zoom+0.00035,1.08))"
        : "if(eq(on,0),1.08,max(zoom-0.00035,1.0))";
    command
      .input(scene.image_path)
      .inputOptions(["-loop 1", `-t ${durationSec}`]);

    filters.push(
      `[${index}:v]zoompan=z='${zoomExpr}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${frames}:s=${imageWidth}x${imageHeight}:fps=${fps},setsar=1[v${index}]`
    );
  });

  const videoLabels = input.scenes.map((_, idx) => `[v${idx}]`).join("");
  filters.push(
    `${videoLabels}concat=n=${input.scenes.length}:v=1:a=0[vout]`
  );

  const audioStartIndex = input.scenes.length;
  input.scenes.forEach((scene) => {
    command.input(scene.audio_path);
  });
  const audioLabels = input.scenes
    .map((_, idx) => `[${audioStartIndex + idx}:a]`)
    .join("");
  filters.push(
    `${audioLabels}concat=n=${input.scenes.length}:v=0:a=1[a_voice]`
  );

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
      `[a_voice][a_bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`
    );
    audioOutLabel = "[aout]";
  }

  await new Promise<void>((resolve, reject) => {
    command
      .complexFilter(filters)
      .outputOptions([
        "-map [vout]",
        `-map ${audioOutLabel}`,
        "-r 30",
        "-c:v libx264",
        "-pix_fmt yuv420p",
        "-c:a aac",
        "-y",
      ])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

async function burnSubtitles(
  inputPath: string,
  srtPath: string,
  outputPath: string
): Promise<void> {
  const escaped = escapeFilterPath(srtPath);
  const filter =
    `subtitles=filename='${escaped}':` +
    "force_style='Fontsize=36,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,BorderStyle=3,Outline=2,Shadow=0,Alignment=2'";
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(filter)
      .outputOptions(["-c:a copy", "-y"])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

export async function assembleVideo(
  input: VideoAssembleInput
): Promise<VideoAssembleResponse> {
  const { videoDir, tmpDir } = await ensureDirs();
  const baseName = `video-${Date.now()}`;
  const intermediate = path.join(tmpDir, `${baseName}-base.mp4`);
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

  await renderSegments(input, intermediate);
  let subtitlesBurned = true;
  try {
    await burnSubtitles(intermediate, srtPath, outputPath);
  } catch (error) {
    subtitlesBurned = false;
    await fs.copyFile(intermediate, outputPath);
  }

  const durationMs = input.scenes.reduce(
    (acc, scene) => acc + scene.duration_ms,
    0
  );

  return {
    video_path: outputPath,
    srt_path: srtPath,
    duration_ms: durationMs,
    subtitles_burned: subtitlesBurned,
  };
}
