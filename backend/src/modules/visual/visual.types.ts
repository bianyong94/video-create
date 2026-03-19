export type VisualCandidate = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  preview_url?: string;
  preview_image_url?: string;
  preview_path?: string;
  source_provider: string;
  source_url?: string;
  source_author?: string;
  source_query?: string;
  score: number;
  title?: string;
  description?: string;
  match_score?: number;
  match_passed?: boolean;
  match_reasons?: string[];
};

export type VisualSceneResult = {
  scene_id: number;
  image_prompt: string;
  media_type?: "image" | "video";
  image_path?: string;
  video_path?: string;
  width: number;
  height: number;
  selected_candidate_id?: string;
  candidates?: VisualCandidate[];
  scene_category?: string;
  source_provider?: string;
  source_url?: string;
  source_author?: string;
  source_query?: string;
  selection_score?: number;
};

export type VisualGenerateResponse = {
  scenes: VisualSceneResult[];
};

export type AspectRatio = "portrait" | "landscape";

export type VisualAspectRatioInput = {
  aspect_ratio?: AspectRatio;
};
