export type BaiduSearchFreshness = "pd" | "pw" | "pm" | "py" | string;

export type BaiduSearchInput = {
  query: string;
  count?: number;
  freshness?: BaiduSearchFreshness;
};

export type BaiduSearchResult = {
  title?: string;
  url?: string;
  snippet?: string;
  site?: string;
  source?: string;
  page_time?: string;
  media_kind?: "video" | "web";
  is_video_like?: boolean;
  [key: string]: unknown;
};
