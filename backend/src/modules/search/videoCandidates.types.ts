import type { AspectRatio } from "../visual/visual.types";

export type VideoCandidateSearchInput = {
  query: string;
  count?: number;
  aspect_ratio?: AspectRatio;
  preview_mode?: "thumbnail" | "download";
};

export type VideoCandidateSearchResult = {
  id: string;
  media_type: "video" | "page";
  media_url: string;
  preview_path?: string;
  preview_url?: string;
  preview_embed_url?: string;
  clip_start_sec?: number;
  clip_end_sec?: number;
  transcript_match_score?: number;
  transcript_matched_text?: string;
  source_provider: string;
  source_url?: string;
  source_author?: string;
  source_query?: string;
  score: number;
  match_score?: number;
  match_passed?: boolean;
  match_reasons?: string[];
  scene_category?: string;
  duration_sec?: number;
  title?: string;
  description?: string;
  page_url?: string;
  page_snippet?: string;
  page_site?: string;
  preview_image_url?: string;
};
