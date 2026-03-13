import type { WordTimestamp } from "../audio/audio.types";

export type VideoSceneInput = {
  scene_id: number;
  image_path: string;
  audio_path: string;
  duration_ms: number;
  timestamps: WordTimestamp[];
};

export type VideoAssembleInput = {
  scenes: VideoSceneInput[];
  projectTitle?: string;
  bgm_enabled?: boolean;
  bgm_style?: string;
  bgm_path?: string;
  bgm_volume?: number;
};

export type VideoAssembleResponse = {
  video_path: string;
  srt_path: string;
  duration_ms: number;
  subtitles_burned?: boolean;
  video_url?: string;
  srt_url?: string;
};
