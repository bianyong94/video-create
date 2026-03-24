export type CommentaryProjectStatus =
  | "draft"
  | "imported"
  | "segmented"
  | "analyzing"
  | "ready"
  | "failed";

export type CommentarySegmentStatus =
  | "pending"
  | "ready"
  | "analyzing"
  | "failed";

export type CommentarySegment = {
  id: string;
  index: number;
  title: string;
  source_path: string;
  source_url?: string;
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  transcript_text?: string;
  transcript_summary?: string;
  commentary_text?: string;
  highlight_text?: string;
  keep_original_audio: boolean;
  original_audio_gain: number;
  commentary_audio_gain: number;
  suggested_clip_start_ms?: number;
  suggested_clip_end_ms?: number;
  status: CommentarySegmentStatus;
  error?: string;
};

export type CommentaryProject = {
  id: string;
  user_id: string;
  title: string;
  source_path: string;
  source_url?: string;
  duration_ms: number;
  status: CommentaryProjectStatus;
  segment_minutes: number;
  segments: CommentarySegment[];
  created_at: string;
  updated_at: string;
};
