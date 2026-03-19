export type WordTimestamp = {
  text: string;
  begin_ms: number;
  end_ms: number;
};

export type AudioSceneResult = {
  scene_id: number;
  narration_text: string;
  recognized_text?: string;
  timing_source?: "text" | "asr";
  voice?: string;
  audio_path: string;
  audio_format: string;
  sample_rate: number;
  duration_ms: number;
  timestamps: WordTimestamp[];
};

export type AudioGenerateResponse = {
  scenes: AudioSceneResult[];
};
