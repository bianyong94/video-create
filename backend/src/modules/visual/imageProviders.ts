import { getImageConfig } from "../../config/env";
import { createHash } from "crypto";
import type { ScriptScene } from "../../utils/json";
import { getAspectDimensions, normalizeAspectRatio } from "../../utils/aspectRatio";
import {
  buildSceneSearchPlan,
  evaluateSearchCandidate,
  scoreSearchCandidate,
  type SceneCategory,
  type SearchMatchEvaluation,
  type SearchProvider,
} from "./searchPlanner";
import type { AspectRatio } from "./visual.types";

type Provider =
  | "qwen"
  | "cogview"
  | "openai"
  | "bilibili"
  | "pexels"
  | "pixabay"
  | "wikimedia"
  | "openverse"
  | "loc"
  | "smithsonian"
  | "europeana"
  | "internet_archive"
  | "baidu_image"
  | "so_image"
  | "stock";

type StockProvider =
  | "bilibili"
  | "pexels"
  | "pixabay"
  | "wikimedia"
  | "openverse"
  | "loc"
  | "smithsonian"
  | "europeana"
  | "internet_archive"
  | "baidu_image"
  | "so_image"
  | "stock";

export type RankedSceneCandidate = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  source_provider: SearchProvider;
  source_url?: string;
  source_author?: string;
  source_query?: string;
  score: number;
  scene_category: SceneCategory;
  duration_sec?: number;
  title?: string;
  description?: string;
  match_score?: number;
  match_passed?: boolean;
  match_reasons?: string[];
};

type ImageResult = {
  buffer: Buffer;
  ext: string;
  mediaType?: "image" | "video";
  durationSec?: number;
  sourceProvider?: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  sourceQuery?: string;
  sceneCategory?: SceneCategory;
  selectionScore?: number;
};

type SearchCandidate = {
  mediaUrl: string;
  mediaType: "image" | "video";
  sourceProvider: SearchProvider;
  sourceUrl?: string;
  sourceAuthor?: string;
  sourceQuery: string;
  title?: string;
  description?: string;
  tags?: string[];
  width?: number;
  height?: number;
  durationSec?: number;
};

type GenerateImageInput =
  | string
  | {
      prompt: string;
      scene?: ScriptScene;
      preferredCandidateId?: string;
      aspectRatio?: AspectRatio;
    };

type QwenResponse = {
  code?: string;
  message?: string;
  output?: {
    task_id?: string;
    task_status?: string;
    code?: string;
    message?: string;
    results?: Array<{
      url?: string;
      image_url?: string;
      base64?: string;
    }>;
  };
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  images?: Array<{
    url?: string;
    base64?: string;
  }>;
};

type CogViewResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
};

type PexelsPhoto = {
  id?: number;
  url?: string;
  alt?: string;
  photographer?: string;
  src?: {
    original?: string;
    large2x?: string;
    portrait?: string;
    large?: string;
    medium?: string;
  };
};

type PexelsResponse = {
  photos?: PexelsPhoto[];
};

type PexelsVideoFile = {
  width?: number;
  height?: number;
  link?: string;
  file_type?: string;
};

type PexelsVideo = {
  id?: number;
  url?: string;
  duration?: number;
  user?: {
    name?: string;
  };
  video_files?: PexelsVideoFile[];
};

type PexelsVideoResponse = {
  videos?: PexelsVideo[];
};

type PixabayHit = {
  pageURL?: string;
  tags?: string;
  user?: string;
  largeImageURL?: string;
  webformatURL?: string;
  imageWidth?: number;
  imageHeight?: number;
};

type PixabayResponse = {
  hits?: PixabayHit[];
};

type PixabayVideoAsset = {
  url?: string;
  width?: number;
  height?: number;
  size?: number;
  thumbnail?: string;
};

type PixabayVideoHit = {
  pageURL?: string;
  tags?: string;
  user?: string;
  duration?: number;
  videos?: {
    large?: PixabayVideoAsset;
    medium?: PixabayVideoAsset;
    small?: PixabayVideoAsset;
    tiny?: PixabayVideoAsset;
  };
};

type PixabayVideoResponse = {
  hits?: PixabayVideoHit[];
};

type BilibiliSearchResponse = {
  code?: number;
  message?: string;
  data?: {
    result?: Array<{
      title?: string;
      arcurl?: string;
      bvid?: string;
      author?: string;
      description?: string;
      pic?: string;
      duration?: string;
    }>;
  };
};

type BilibiliViewResponse = {
  code?: number;
  message?: string;
  data?: {
    bvid?: string;
    title?: string;
    desc?: string;
    pic?: string;
    owner?: {
      name?: string;
    };
    cid?: number;
    duration?: number;
    pages?: Array<{
      cid?: number;
      duration?: number;
      part?: string;
      first_frame?: string;
    }>;
  };
};

type BilibiliPlayUrlResponse = {
  code?: number;
  message?: string;
  data?: {
    durl?: Array<{
      url?: string;
      size?: number;
      length?: number;
    }>;
    dash?: {
      video?: Array<{
        baseUrl?: string;
        base_url?: string;
      }>;
    };
  };
};

type WikimediaPage = {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    mime?: string;
    descriptionurl?: string;
  }>;
};

type WikimediaResponse = {
  query?: {
    pages?: Record<string, WikimediaPage>;
  };
};

type OpenverseResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    creator?: string;
    foreign_landing_url?: string;
    tags?: Array<{ name?: string }>;
    width?: number;
    height?: number;
  }>;
};

type LocResponse = {
  results?: Array<{
    title?: string;
    description?: string[];
    image_url?: string[];
    mime_type?: string[];
    original_format?: string[];
    online_format?: string[];
    item?: {
      title?: string;
      subjects?: string[];
    };
    subject?: string[];
    url?: string;
  }>;
};

type SmithsonianSearchResponse = {
  response?: {
    rows?: Array<{
      title?: string;
      url?: string;
      content?: {
        freetext?: {
          notes?: Array<{ content?: string }>;
          topic?: Array<{ content?: string }>;
        };
        descriptiveNonRepeating?: {
          record_link?: string;
          online_media?: {
            media?: Array<{
              type?: string;
              content?: string;
              thumbnail?: string;
            }>;
          };
        };
      };
    }>;
  };
};

type EuropeanaResponse = {
  items?: Array<{
    title?: string[];
    dcDescription?: string[];
    edmPreview?: string[];
    edmIsShownBy?: string[];
    edmIsShownAt?: string[];
    guid?: string;
    dcCreator?: string[];
    dcSubject?: string[];
    year?: string[];
    type?: string;
  }>;
};

type InternetArchiveSearchResponse = {
  response?: {
    docs?: Array<{
      identifier?: string;
      title?: string;
      mediatype?: string;
      creator?: string;
      description?: string;
      subject?: string[] | string;
    }>;
  };
};

type InternetArchiveMetadataResponse = {
  files?: Array<{
    name?: string;
    format?: string;
    size?: string;
    width?: string;
    height?: string;
    length?: string;
  }>;
  metadata?: {
    title?: string;
    description?: string;
    creator?: string;
  };
};

type BaiduImageResponse = {
  data?: Array<{
    thumbURL?: string;
    middleURL?: string;
    objURL?: string;
    fromPageTitleEnc?: string;
    fromPageTitle?: string;
    fromURL?: string;
    fromPageUrl?: string;
    width?: string;
    height?: string;
  } | null>;
};

type SoImageResponse = {
  list?: Array<{
    title?: string;
    img?: string;
    thumb?: string;
    link?: string;
    site?: string;
    width?: string | number;
    height?: string | number;
  }>;
};

export class ImageProviderError extends Error {
  code?: string;
  provider: Provider;

  constructor(provider: Provider, code: string | undefined, message: string) {
    super(message);
    this.code = code;
    this.provider = provider;
  }
}

function guessExt(contentType?: string): string {
  if (!contentType) return "png";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("tiff")) return "tiff";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("png")) return "png";
  return "png";
}

async function fetchMedia(
  url: string,
  init?: RequestInit
): Promise<ImageResult> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? undefined;
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    ext: guessExt(contentType),
    mediaType: contentType?.startsWith("video/") ? "video" : "image",
  };
}

function decodeBase64(data: string): ImageResult {
  const cleaned = data.replace(/^data:\w+\/\w+;base64,/, "");
  return { buffer: Buffer.from(cleaned, "base64"), ext: "png" };
}

function pickQwenSize(width: number, height: number): string {
  const portrait = height >= width;
  if (width === height) return "1024*1024";
  if (portrait) {
    return height / width >= 1.5 ? "720*1280" : "768*1152";
  }
  return "1280*720";
}

function pickOpenAISize(width: number, height: number): string {
  if (width === height) return "1024x1024";
  return height >= width ? "1024x1536" : "1536x1024";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildStockQuery(prompt: string): string {
  return prompt
    .replace(/[^A-Za-z0-9\u4e00-\u9fff\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function simplifyStockQuery(query: string): string {
  const tokens = buildStockQuery(query)
    .split(" ")
    .filter(Boolean);
  return tokens.slice(0, Math.min(tokens.length, 4)).join(" ");
}

function scoreVideoDimensions(width = 0, height = 0): number {
  const ratioScore = height >= width ? 2 : 1;
  return ratioScore * 1_000_000 + height * 1000 + width;
}

function buildFallbackScene(prompt: string): ScriptScene {
  return {
    scene_id: 1,
    narration_text: prompt,
    image_prompt: prompt,
    stock_query: prompt,
  };
}

function isRetriableQwenStatus(status?: string): boolean {
  return status === "PENDING" || status === "RUNNING" || status === "QUEUED" || !status;
}

function getImageUrlFromList(urls?: string[]): string | undefined {
  if (!urls?.length) return undefined;
  return (
    urls.find((item) => item && !item.includes("#") && /\.(jpg|jpeg|png|webp|gif)$/i.test(item)) ??
    urls.find((item) => item && !item.includes("#")) ??
    urls[0]
  );
}

function parseNumber(value?: string | number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toDurationSeconds(value?: string): number | undefined {
  if (!value) return undefined;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(":").map((item) => Number(item));
  if (parts.some((item) => Number.isNaN(item))) return undefined;
  return parts.reduce((sum, item) => sum * 60 + item, 0);
}

function sanitizeSubjects(value?: string[] | string): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean).slice(0, 12);
  }
  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
}

function compactCandidates(
  items: Array<SearchCandidate | null | undefined>
): SearchCandidate[] {
  return items.filter((item): item is SearchCandidate => Boolean(item));
}

function getCandidateId(candidate: SearchCandidate): string {
  return createHash("sha1")
    .update(
      `${candidate.sourceProvider}|${candidate.mediaType}|${candidate.mediaUrl}`
    )
    .digest("hex")
    .slice(0, 16);
}

function toRankedSceneCandidate(
  candidate: SearchCandidate,
  score: number,
  sceneCategory: SceneCategory,
  matchEvaluation?: SearchMatchEvaluation
): RankedSceneCandidate {
  return {
    id: getCandidateId(candidate),
    media_type: candidate.mediaType,
    media_url: candidate.mediaUrl,
    source_provider: candidate.sourceProvider,
    source_url: candidate.sourceUrl,
    source_author: candidate.sourceAuthor,
    source_query: candidate.sourceQuery,
    score,
    scene_category: sceneCategory,
    duration_sec: candidate.durationSec,
    title: candidate.title,
    description: candidate.description,
    match_score: matchEvaluation?.matchScore,
    match_passed: matchEvaluation?.matchPassed,
    match_reasons: matchEvaluation?.matchReasons,
  };
}

function mapCandidateToResult(
  candidate: SearchCandidate,
  media: ImageResult,
  sceneCategory: SceneCategory,
  selectionScore: number
): ImageResult {
  return {
    ...media,
    mediaType: candidate.mediaType,
    durationSec: candidate.durationSec,
    sourceProvider: candidate.sourceProvider,
    sourceUrl: candidate.sourceUrl,
    sourceAuthor: candidate.sourceAuthor,
    sourceQuery: candidate.sourceQuery,
    sceneCategory,
    selectionScore,
  };
}

function getInputPrompt(input: GenerateImageInput): string {
  return typeof input === "string" ? input : input.prompt;
}

function getInputScene(input: GenerateImageInput): ScriptScene {
  return typeof input === "string"
    ? buildFallbackScene(input)
    : input.scene ?? buildFallbackScene(input.prompt);
}

function getPreferredCandidateId(input: GenerateImageInput): string | undefined {
  if (typeof input === "string") return undefined;
  return input.preferredCandidateId;
}

function getConfiguredSearchProviders(provider: Provider): SearchProvider[] {
  const config = getImageConfig();
  void config;
  const allProviders: SearchProvider[] = ["bilibili"];
  const configured = allProviders;

  if (provider === "stock") return configured;
  return configured.filter((item) => item === provider);
}

async function pollQwenTask(taskId: string): Promise<QwenResponse> {
  const config = getImageConfig();
  const taskUrl = `${config.qwenApiBase}/api/v1/tasks/${taskId}`;
  const timeoutMs = Math.max(90_000, config.qwenTaskTimeoutMs);
  const intervalMs = Math.max(800, config.qwenTaskPollIntervalMs);
  const maxAttempts = Math.ceil(timeoutMs / intervalMs);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(taskUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.qwenApiKey}`,
      },
    });
    const data = (await response.json()) as QwenResponse;
    const status = data.output?.task_status;
    if (status === "SUCCEEDED") return data;
    if (status === "FAILED") {
      const code = data.output?.code ?? "FAILED";
      const message = data.output?.message ?? "Qwen image task failed";
      throw new ImageProviderError("qwen", code, `Qwen image task failed: ${code} ${message}`);
    }
    if (!isRetriableQwenStatus(status)) {
      throw new ImageProviderError(
        "qwen",
        status ?? "UnexpectedStatus",
        `Qwen image task returned unexpected status: ${status ?? "unknown"}`
      );
    }
    await sleep(intervalMs);
  }

  throw new ImageProviderError("qwen", "TaskTimeout", "Qwen image task timeout.");
}

async function searchPexelsCandidates(
  query: string,
  aspectRatio: AspectRatio = "portrait"
): Promise<SearchCandidate[]> {
  const config = getImageConfig();
  const photoUrl = new URL("https://api.pexels.com/v1/search");
  photoUrl.searchParams.set("query", buildStockQuery(query));
  photoUrl.searchParams.set(
    "orientation",
    aspectRatio === "landscape" ? "landscape" : "portrait"
  );
  photoUrl.searchParams.set("size", "large");
  photoUrl.searchParams.set("per_page", "8");

  const videoUrl = new URL("https://api.pexels.com/videos/search");
  videoUrl.searchParams.set("query", buildStockQuery(query));
  videoUrl.searchParams.set(
    "orientation",
    aspectRatio === "landscape" ? "landscape" : "portrait"
  );
  videoUrl.searchParams.set("size", "medium");
  videoUrl.searchParams.set("per_page", "6");

  const [photoResponse, videoResponse] = await Promise.all([
    fetch(photoUrl.toString(), {
      headers: { Authorization: config.pexelsApiKey },
    }),
    fetch(videoUrl.toString(), {
      headers: { Authorization: config.pexelsApiKey },
    }),
  ]);

  const photoData = (await photoResponse.json()) as PexelsResponse;
  const videoData = (await videoResponse.json()) as PexelsVideoResponse;

  const imageCandidates = (photoData.photos ?? []).map((photo) => {
    const mediaUrl =
      photo.src?.portrait ??
      photo.src?.large2x ??
      photo.src?.large ??
      photo.src?.medium ??
      photo.src?.original;
    if (!mediaUrl) return null;
    return {
      mediaUrl,
      mediaType: "image" as const,
      sourceProvider: "pexels" as const,
      sourceUrl: photo.url,
      sourceAuthor: photo.photographer,
      sourceQuery: query,
      title: photo.alt,
      width: 1080,
      height: 1920,
    };
  });

  const videoCandidates = (videoData.videos ?? []).map((video) => {
    const file = (video.video_files ?? [])
      .filter((item) => item.link && item.file_type?.includes("mp4"))
      .sort(
        (left, right) =>
          scoreVideoDimensions(right.width, right.height) -
          scoreVideoDimensions(left.width, left.height)
      )[0];
    if (!file?.link) return null;
    return {
      mediaUrl: file.link,
      mediaType: "video" as const,
      sourceProvider: "pexels" as const,
      sourceUrl: video.url,
      sourceAuthor: video.user?.name,
      sourceQuery: query,
      durationSec: video.duration,
      width: file.width,
      height: file.height,
    };
  });

  return [...compactCandidates(videoCandidates), ...compactCandidates(imageCandidates)];
}

async function searchPixabayCandidates(
  query: string,
  aspectRatio: AspectRatio = "portrait"
): Promise<SearchCandidate[]> {
  const config = getImageConfig();
  const imageUrl = new URL("https://pixabay.com/api/");
  imageUrl.searchParams.set("key", config.pixabayApiKey);
  imageUrl.searchParams.set("q", buildStockQuery(query));
  imageUrl.searchParams.set("image_type", "photo");
  imageUrl.searchParams.set("orientation", aspectRatio === "landscape" ? "horizontal" : "vertical");
  imageUrl.searchParams.set("safesearch", "true");
  imageUrl.searchParams.set("per_page", "8");

  const videoUrl = new URL("https://pixabay.com/api/videos/");
  videoUrl.searchParams.set("key", config.pixabayApiKey);
  videoUrl.searchParams.set("q", buildStockQuery(query));
  videoUrl.searchParams.set("video_type", "film");
  videoUrl.searchParams.set("safesearch", "true");
  videoUrl.searchParams.set("per_page", "6");

  const [imageResponse, videoResponse] = await Promise.all([
    fetch(imageUrl.toString()),
    fetch(videoUrl.toString()),
  ]);

  const imageData = (await imageResponse.json()) as PixabayResponse;
  const videoData = (await videoResponse.json()) as PixabayVideoResponse;

  const imageCandidates = (imageData.hits ?? [])
    .map((hit) => {
      const mediaUrl = hit.largeImageURL ?? hit.webformatURL;
      if (!mediaUrl) return null;
      return {
        mediaUrl,
        mediaType: "image" as const,
        sourceProvider: "pixabay" as const,
        sourceUrl: hit.pageURL,
        sourceAuthor: hit.user,
        sourceQuery: query,
        tags: hit.tags?.split(",").map((item) => item.trim()),
        width: hit.imageWidth,
        height: hit.imageHeight,
      };
    })
  ;

  const videoCandidates = (videoData.hits ?? [])
    .map((hit) => {
      const asset =
        hit.videos?.large ??
        hit.videos?.medium ??
        hit.videos?.small ??
        hit.videos?.tiny;
      if (!asset?.url) return null;
      return {
        mediaUrl: asset.url,
        mediaType: "video" as const,
        sourceProvider: "pixabay" as const,
        sourceUrl: hit.pageURL,
        sourceAuthor: hit.user,
        sourceQuery: query,
        tags: hit.tags?.split(",").map((item) => item.trim()),
        width: asset.width,
        height: asset.height,
        durationSec: hit.duration,
      };
    })
  ;

  return [...compactCandidates(videoCandidates), ...compactCandidates(imageCandidates)];
}

async function searchWikimediaCandidates(query: string): Promise<SearchCandidate[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", buildStockQuery(query));
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime");
  url.searchParams.set("origin", "*");

  const response = await fetch(url.toString());
  const data = (await response.json()) as WikimediaResponse;

  return Object.values(data.query?.pages ?? {})
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.url || info.mime?.includes("svg")) return null;
      return {
        mediaUrl: info.url,
        mediaType: info.mime?.startsWith("video/") ? ("video" as const) : ("image" as const),
        sourceProvider: "wikimedia" as const,
        sourceUrl: info.descriptionurl,
        sourceAuthor: page.title,
        sourceQuery: query,
        title: page.title,
      };
    })
    .filter(Boolean) as SearchCandidate[];
}

async function searchOpenverseCandidates(query: string): Promise<SearchCandidate[]> {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", buildStockQuery(query));
  url.searchParams.set("page_size", "8");

  const response = await fetch(url.toString());
  const data = (await response.json()) as OpenverseResponse;

  return (data.results ?? [])
    .map((item) => {
      if (!item.url) return null;
      return {
        mediaUrl: item.url,
        mediaType: "image" as const,
        sourceProvider: "openverse" as const,
        sourceUrl: item.foreign_landing_url,
        sourceAuthor: item.creator,
        sourceQuery: query,
        title: item.title,
        tags: item.tags?.map((tag) => tag.name ?? "").filter(Boolean),
        width: item.width,
        height: item.height,
      };
    })
    .filter(Boolean) as SearchCandidate[];
}

async function searchLocCandidates(query: string): Promise<SearchCandidate[]> {
  const url = new URL("https://www.loc.gov/search/");
  url.searchParams.set("q", buildStockQuery(query));
  url.searchParams.set("fo", "json");
  url.searchParams.set("c", "8");

  const response = await fetch(url.toString());
  const data = (await response.json()) as LocResponse;

  return (data.results ?? [])
    .map((item) => {
      const mediaUrl = getImageUrlFromList(item.image_url);
      if (!mediaUrl) return null;
      return {
        mediaUrl,
        mediaType: "image" as const,
        sourceProvider: "loc" as const,
        sourceUrl: item.url,
        sourceQuery: query,
        title: item.title ?? item.item?.title,
        description: item.description?.join(" "),
        tags: [
          ...(item.subject ?? item.item?.subjects ?? []),
          ...(item.original_format ?? []),
          ...(item.online_format ?? []),
        ],
      };
    })
    .filter(Boolean) as SearchCandidate[];
}

async function searchSmithsonianCandidates(query: string): Promise<SearchCandidate[]> {
  const config = getImageConfig();
  const url = new URL("https://api.si.edu/openaccess/api/v1.0/search");
  url.searchParams.set("q", buildStockQuery(query));
  url.searchParams.set("rows", "8");
  url.searchParams.set("api_key", config.smithsonianApiKey);

  const response = await fetch(url.toString());
  const data = (await response.json()) as SmithsonianSearchResponse;

  return (data.response?.rows ?? [])
    .flatMap((row) => {
      const mediaList =
        row.content?.descriptiveNonRepeating?.online_media?.media ?? [];
      return mediaList.map((media) => {
        const mediaUrl = media.content ?? media.thumbnail;
        if (!mediaUrl) return null;
        return {
          mediaUrl,
          mediaType: media.type?.includes("video")
            ? ("video" as const)
            : ("image" as const),
          sourceProvider: "smithsonian" as const,
          sourceUrl:
            row.content?.descriptiveNonRepeating?.record_link ?? row.url,
          sourceQuery: query,
          title: row.title,
          description: row.content?.freetext?.notes?.map((item) => item.content).join(" "),
          tags: row.content?.freetext?.topic?.map((item) => item.content ?? "").filter(Boolean),
        };
      });
    })
    .filter(Boolean) as SearchCandidate[];
}

async function searchEuropeanaCandidates(query: string): Promise<SearchCandidate[]> {
  const config = getImageConfig();
  const url = new URL("https://api.europeana.eu/record/v2/search.json");
  url.searchParams.set("wskey", config.europeanaApiKey);
  url.searchParams.set("query", buildStockQuery(query));
  url.searchParams.set("rows", "8");
  url.searchParams.set("media", "true");

  const response = await fetch(url.toString());
  const data = (await response.json()) as EuropeanaResponse;

  return (data.items ?? [])
    .map((item) => {
      const mediaUrl = item.edmIsShownBy?.[0] ?? item.edmPreview?.[0];
      if (!mediaUrl) return null;
      return {
        mediaUrl,
        mediaType: "image" as const,
        sourceProvider: "europeana" as const,
        sourceUrl: item.guid ?? item.edmIsShownAt?.[0],
        sourceAuthor: item.dcCreator?.join(", "),
        sourceQuery: query,
        title: item.title?.[0],
        description: item.dcDescription?.join(" "),
        tags: item.dcSubject,
      };
    })
    .filter(Boolean) as SearchCandidate[];
}

async function searchInternetArchiveCandidates(
  query: string
): Promise<SearchCandidate[]> {
  const url = new URL("https://archive.org/advancedsearch.php");
  const normalizedQuery = buildStockQuery(query);
  url.searchParams.set("q", `title:(\"${normalizedQuery}\") OR subject:(\"${normalizedQuery}\")`);
  url.searchParams.append("fl[]", "identifier");
  url.searchParams.append("fl[]", "title");
  url.searchParams.append("fl[]", "mediatype");
  url.searchParams.append("fl[]", "creator");
  url.searchParams.append("fl[]", "description");
  url.searchParams.append("fl[]", "subject");
  url.searchParams.set("rows", "4");
  url.searchParams.set("output", "json");

  const response = await fetch(url.toString());
  const data = (await response.json()) as InternetArchiveSearchResponse;

  const metadataResponses = await Promise.all(
    (data.response?.docs ?? [])
      .filter((item) => item.identifier)
      .map(async (doc) => {
        const metadataUrl = `https://archive.org/metadata/${doc.identifier}`;
        const metadataResponse = await fetch(metadataUrl);
        const metadata = (await metadataResponse.json()) as InternetArchiveMetadataResponse;
        return { doc, metadata };
      })
  );

  return metadataResponses.flatMap(({ doc, metadata }) => {
    if (doc.mediatype === "texts") {
      return [];
    }

    const baseUrl = `https://archive.org/download/${doc.identifier}`;
    const common = {
      sourceUrl: `https://archive.org/details/${doc.identifier}`,
      sourceAuthor: doc.creator ?? metadata.metadata?.creator,
      sourceQuery: query,
      title: doc.title ?? metadata.metadata?.title,
      description: doc.description ?? metadata.metadata?.description,
      tags: sanitizeSubjects(doc.subject),
    };

    return (metadata.files ?? [])
      .filter((file) => {
        const name = file.name?.toLowerCase() ?? "";
        const size = parseNumber(file.size) ?? 0;
        if (size > 120_000_000) return false;
        return (
          /\.(mp4|mov|webm|jpg|jpeg|png|webp)$/i.test(name) &&
          !/page|cover|jp2|djvu|text/.test(name) &&
          !name.includes("_thumb") &&
          !name.includes("thumb")
        );
      })
      .map((file) => {
        if (!file.name) return null;
        const mediaUrl = `${baseUrl}/${encodeURIComponent(file.name).replace(/%2F/g, "/")}`;
        const video = /\.(mp4|mov|webm)$/i.test(file.name);
        return {
          mediaUrl,
          mediaType: video ? ("video" as const) : ("image" as const),
          sourceProvider: "internet_archive" as const,
          ...common,
          width: parseNumber(file.width),
          height: parseNumber(file.height),
          durationSec: toDurationSeconds(file.length),
        };
      })
      .filter(Boolean) as SearchCandidate[];
  });
}

async function searchBaiduImageCandidates(query: string): Promise<SearchCandidate[]> {
  const url = new URL("https://image.baidu.com/search/acjson");
  url.searchParams.set("tn", "resultjson_com");
  url.searchParams.set("ipn", "rj");
  url.searchParams.set("word", buildStockQuery(query));
  url.searchParams.set("pn", "0");
  url.searchParams.set("rn", "20");
  url.searchParams.set("ie", "utf-8");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const data = (await response.json()) as BaiduImageResponse;

  return (data.data ?? [])
    .map((item) => {
      if (!item) return null;
      const mediaUrl = item.middleURL ?? item.thumbURL ?? item.objURL;
      if (!mediaUrl) return null;
      return {
        mediaUrl,
        mediaType: "image" as const,
        sourceProvider: "baidu_image" as const,
        sourceUrl: item.fromURL ?? item.fromPageUrl,
        sourceQuery: query,
        title: item.fromPageTitleEnc ?? item.fromPageTitle,
        width: parseNumber(item.width),
        height: parseNumber(item.height),
      };
    })
    .filter(Boolean) as SearchCandidate[];
}

async function searchSoImageCandidates(query: string): Promise<SearchCandidate[]> {
  const url = new URL("https://image.so.com/j");
  url.searchParams.set("q", buildStockQuery(query));
  url.searchParams.set("sn", "0");
  url.searchParams.set("pn", "20");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const data = (await response.json()) as SoImageResponse;

  return (data.list ?? [])
    .map((item) => {
      const mediaUrl = item.img ?? item.thumb;
      if (!mediaUrl) return null;
      return {
        mediaUrl,
        mediaType: "image" as const,
        sourceProvider: "so_image" as const,
        sourceUrl: item.link,
        sourceAuthor: item.site,
        sourceQuery: query,
        title: item.title,
        width: parseNumber(item.width),
        height: parseNumber(item.height),
      };
    })
    .filter(Boolean) as SearchCandidate[];
}

function decodeBilibiliEscapedText(value?: string): string {
  if (!value) return "";
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value
      .replace(/\\u003c/gi, "<")
      .replace(/\\u003e/gi, ">")
      .replace(/\\"/g, '"')
      .replace(/\\\//g, "/");
  }
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function extractBilibiliCards(html: string): Array<{
  title?: string;
  arcurl?: string;
  bvid?: string;
  author?: string;
  description?: string;
  pic?: string;
  duration?: string;
}> {
  const cards: Array<{
    title?: string;
    arcurl?: string;
    bvid?: string;
    author?: string;
    description?: string;
    pic?: string;
    duration?: string;
  }> = [];
  const seen = new Set<string>();
  const regex = /arcurl:"([^"]+)"/g;
  const extractField = (chunk: string, field: string): string | undefined => {
    const match = chunk.match(new RegExp(`${field}:"((?:\\\\.|[^"])*)"`, "m"));
    return match?.[1];
  };

  for (const match of html.matchAll(regex)) {
    const start = Math.max(0, match.index ?? 0);
    const chunk = html.slice(start, Math.min(html.length, start + 2200));
    const arcurl = decodeBilibiliEscapedText(match[1]);
    const bvid = extractField(chunk, "bvid");
    if (!arcurl || !bvid || seen.has(bvid)) continue;
    seen.add(bvid);
    cards.push({
      title: decodeBilibiliEscapedText(extractField(chunk, "title")),
      arcurl,
      bvid: decodeBilibiliEscapedText(bvid),
      author: decodeBilibiliEscapedText(extractField(chunk, "author")),
      description: decodeBilibiliEscapedText(extractField(chunk, "description")),
      pic: decodeBilibiliEscapedText(extractField(chunk, "pic")),
      duration: decodeBilibiliEscapedText(extractField(chunk, "duration")),
    });
  }

  return cards;
}

async function resolveBilibiliMediaUrl(
  bvid: string
): Promise<{ mediaUrl?: string; durationSec?: number; title?: string; description?: string; sourceAuthor?: string; sourceUrl?: string; thumbnail?: string }> {
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Referer: "https://www.bilibili.com/",
  };

  const viewUrl = new URL("https://api.bilibili.com/x/web-interface/view");
  viewUrl.searchParams.set("bvid", bvid);
  const viewResponse = await fetch(viewUrl.toString(), { headers });
  const view = (await viewResponse.json()) as BilibiliViewResponse;

  if (view.code && view.code !== 0) {
    throw new Error(`Bilibili view API error: ${view.message ?? view.code}`);
  }

  const cid = view.data?.cid ?? view.data?.pages?.[0]?.cid;
  if (!cid) {
    return {
      title: view.data?.title,
      description: view.data?.desc,
      sourceAuthor: view.data?.owner?.name,
      sourceUrl: `https://www.bilibili.com/video/${bvid}`,
      thumbnail: view.data?.pic,
      durationSec: view.data?.duration,
    };
  }

  const playUrl = new URL("https://api.bilibili.com/x/player/playurl");
  playUrl.searchParams.set("bvid", bvid);
  playUrl.searchParams.set("cid", String(cid));
  playUrl.searchParams.set("qn", "64");
  playUrl.searchParams.set("fnval", "0");

  const playResponse = await fetch(playUrl.toString(), { headers });
  const play = (await playResponse.json()) as BilibiliPlayUrlResponse;

  if (play.code && play.code !== 0) {
    throw new Error(`Bilibili playurl API error: ${play.message ?? play.code}`);
  }

  const directUrl = play.data?.durl?.[0]?.url;
  if (!directUrl) {
    return {
      title: view.data?.title,
      description: view.data?.desc,
      sourceAuthor: view.data?.owner?.name,
      sourceUrl: `https://www.bilibili.com/video/${bvid}`,
      thumbnail: view.data?.pic ?? view.data?.pages?.[0]?.first_frame,
      durationSec: view.data?.duration ?? view.data?.pages?.[0]?.duration,
    };
  }
  return {
    mediaUrl: directUrl,
    durationSec: view.data?.duration ?? view.data?.pages?.[0]?.duration,
    title: view.data?.title,
    description: view.data?.desc,
    sourceAuthor: view.data?.owner?.name,
    sourceUrl: `https://www.bilibili.com/video/${bvid}`,
    thumbnail: view.data?.pic ?? view.data?.pages?.[0]?.first_frame,
  };
}

async function searchBilibiliCandidates(query: string): Promise<SearchCandidate[]> {
  const searchUrl = new URL("https://search.bilibili.com/video");
  searchUrl.searchParams.set("keyword", buildStockQuery(query));
  searchUrl.searchParams.set("page", "1");

  const response = await fetch(searchUrl.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: "https://www.bilibili.com/",
    },
  });
  const html = await response.text();
  const cards = extractBilibiliCards(html).slice(0, 8);

  const resolved = await Promise.all(
    cards.map(async (card) => {
      if (!card.bvid) return null;
      try {
        const media = await resolveBilibiliMediaUrl(card.bvid);
        if (!media.mediaUrl) return null;
        return {
          mediaUrl: media.mediaUrl,
          mediaType: "video" as const,
          sourceProvider: "bilibili" as const,
          sourceUrl: media.sourceUrl ?? card.arcurl,
          sourceAuthor: media.sourceAuthor ?? card.author,
          sourceQuery: query,
          title: stripHtmlTags(media.title ?? card.title ?? ""),
          description: stripHtmlTags(media.description ?? card.description ?? ""),
          durationSec: media.durationSec ?? toDurationSeconds(card.duration),
          tags: ["bilibili", "b站", "哔哩哔哩"],
          width: 1920,
          height: 1080,
        } satisfies SearchCandidate;
      } catch {
        return null;
      }
    })
  );

  return resolved.filter(Boolean) as SearchCandidate[];
}

async function searchCandidatesByProvider(
  provider: SearchProvider,
  query: string,
  aspectRatio: AspectRatio
): Promise<SearchCandidate[]> {
  if (provider === "bilibili") return searchBilibiliCandidates(query);
  if (provider === "pexels") return searchPexelsCandidates(query, aspectRatio);
  if (provider === "pixabay") return searchPixabayCandidates(query, aspectRatio);
  if (provider === "wikimedia") return searchWikimediaCandidates(query);
  if (provider === "openverse") return searchOpenverseCandidates(query);
  if (provider === "loc") return searchLocCandidates(query);
  if (provider === "smithsonian") return searchSmithsonianCandidates(query);
  if (provider === "europeana") return searchEuropeanaCandidates(query);
  if (provider === "baidu_image") return searchBaiduImageCandidates(query);
  if (provider === "so_image") return searchSoImageCandidates(query);
  return searchInternetArchiveCandidates(query);
}

function dedupeCandidates(candidates: SearchCandidate[]): SearchCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.sourceProvider}:${candidate.mediaUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buildRankedCandidates(
  scene: ScriptScene,
  provider: StockProvider,
  aspectRatio: AspectRatio = "portrait"
): Promise<RankedSceneCandidate[]> {
  const plan = buildSceneSearchPlan(scene, aspectRatio);
  const providers =
    provider === "stock"
      ? plan.providerOrder.filter((item) =>
          getConfiguredSearchProviders("stock").includes(item)
        )
      : getConfiguredSearchProviders(provider);

  if (!providers.length) {
    throw new ImageProviderError(
      provider,
      "NoProvider",
      "No configured search providers available."
    );
  }

  const tasks = plan.queryVariants.flatMap((query, index) =>
    providers
      .slice(0, index === 0 ? providers.length : Math.min(4, providers.length))
      .map(async (item) => {
        try {
          return await searchCandidatesByProvider(item, query, aspectRatio);
        } catch {
          return [] as SearchCandidate[];
        }
      })
  );

  let candidates = dedupeCandidates((await Promise.all(tasks)).flat());

  if (!candidates.length) {
    const simplified = simplifyStockQuery(plan.queryVariants[0] ?? scene.stock_query ?? "");
    if (simplified && !plan.queryVariants.includes(simplified)) {
      const fallbackTasks = providers.map(async (item) => {
        try {
          return await searchCandidatesByProvider(item, simplified, aspectRatio);
        } catch {
          return [] as SearchCandidate[];
        }
      });
      candidates = dedupeCandidates((await Promise.all(fallbackTasks)).flat());
    }
  }

  if (plan.videoOnly) {
    candidates = candidates.filter((candidate) => candidate.mediaType === "video");
  }

  if (!candidates.length) {
    throw new ImageProviderError(
      provider,
      "NoResult",
      "Search providers returned no relevant media."
    );
  }

  const ranked = candidates
    .map((candidate) => {
      const matchEvaluation = evaluateSearchCandidate(candidate, plan, scene);
      return {
        candidate,
        matchEvaluation,
        score: scoreSearchCandidate(candidate, plan, scene, matchEvaluation),
      };
    })
    .filter((entry) => entry.score > -20)
    .sort((left, right) => right.score - left.score);

  const prioritizedEntries =
    plan.preferVideo && ranked.some((entry) => entry.candidate.mediaType === "video")
      ? [
          ...ranked.filter((entry) => entry.candidate.mediaType === "video"),
          ...ranked.filter((entry) => entry.candidate.mediaType !== "video"),
        ]
      : ranked;

  const matchedEntries = prioritizedEntries.filter((entry) => entry.matchEvaluation.matchPassed);
  const prioritized = (matchedEntries.length ? matchedEntries : prioritizedEntries).map((entry) =>
    toRankedSceneCandidate(entry.candidate, entry.score, plan.category, entry.matchEvaluation)
  );

  if (!prioritized.length) {
    throw new ImageProviderError(
      provider,
      "NoResult",
      "Search providers returned no ranked media."
    );
  }

  return prioritized;
}

export async function searchRankedCandidates(
  scene: ScriptScene,
  provider: StockProvider,
  limit = 12,
  aspectRatio: AspectRatio = "portrait"
): Promise<RankedSceneCandidate[]> {
  const ranked = await buildRankedCandidates(scene, provider, aspectRatio);
  return ranked.slice(0, Math.max(1, limit));
}

function mapRankedCandidateToSearchCandidate(
  candidate: RankedSceneCandidate
): SearchCandidate {
  return {
    mediaUrl: candidate.media_url,
    mediaType: candidate.media_type,
    sourceProvider: candidate.source_provider,
    sourceUrl: candidate.source_url,
    sourceAuthor: candidate.source_author,
    sourceQuery: candidate.source_query ?? "",
    title: candidate.title,
    description: candidate.description,
    durationSec: candidate.duration_sec,
  };
}

export async function materializeCandidate(
  candidate: RankedSceneCandidate
): Promise<ImageResult> {
  const media = await fetchMedia(
    candidate.media_url,
    candidate.source_provider === "bilibili"
      ? {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://www.bilibili.com/",
          },
        }
      : undefined
  );
  return mapCandidateToResult(
    mapRankedCandidateToSearchCandidate(candidate),
    media,
    candidate.scene_category,
    candidate.score
  );
}

async function searchAndRankStockMedia(
  scene: ScriptScene,
  provider: StockProvider,
  preferredCandidateId?: string
): Promise<ImageResult> {
  const ranked = await searchRankedCandidates(scene, provider, 20);
  const prioritized = preferredCandidateId
    ? [
        ...ranked.filter((item) => item.id === preferredCandidateId),
        ...ranked.filter((item) => item.id !== preferredCandidateId),
      ]
    : ranked;

  let lastError: unknown = null;
  for (const candidate of prioritized.slice(0, 6)) {
    try {
      return await materializeCandidate(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw new ImageProviderError(
    provider,
    "DownloadFailed",
    lastError instanceof Error
      ? lastError.message
      : "Failed to download ranked media."
  );
}

export async function generateImage(
  input: GenerateImageInput,
  providerOverride?: Provider
): Promise<ImageResult> {
  const config = getImageConfig();
  const prompt = getInputPrompt(input);
  const scene = getInputScene(input);
  const preferredCandidateId = getPreferredCandidateId(input);
  const aspectRatio = normalizeAspectRatio(
    typeof input === "string" ? undefined : input.aspectRatio
  );
  const dimensions = getAspectDimensions(
    aspectRatio,
    config.imageWidth,
    config.imageHeight
  );
  const provider = providerOverride ?? config.imageProvider;

  if (provider === "qwen") {
    if (!prompt.trim()) {
      throw new Error("Image prompt is empty.");
    }

    const url = `${config.qwenApiBase}${config.qwenApiPath}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.qwenApiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: config.qwenModel,
        input: { prompt },
        parameters: {
          n: 1,
          size: pickQwenSize(dimensions.width, dimensions.height),
        },
      }),
    });
    const data = (await response.json()) as QwenResponse;

    if (!response.ok) {
      throw new ImageProviderError(
        "qwen",
        data.output?.code ?? data.code,
        `Qwen image API error: ${JSON.stringify(data)}`
      );
    }

    const syncCandidate =
      data.output?.results?.[0]?.url ??
      data.output?.results?.[0]?.image_url ??
      data.images?.[0]?.url ??
      data.data?.[0]?.url;
    const syncBase64 =
      data.output?.results?.[0]?.base64 ??
      data.images?.[0]?.base64 ??
      data.data?.[0]?.b64_json;

    if (syncCandidate) return fetchMedia(syncCandidate);
    if (syncBase64) return decodeBase64(syncBase64);

    const taskId = data.output?.task_id;
    if (!taskId) {
      throw new ImageProviderError(
        "qwen",
        "MissingTaskId",
        `Qwen image API missing task_id: ${JSON.stringify(data)}`
      );
    }

    const result = await pollQwenTask(taskId);
    const candidate =
      result.output?.results?.[0]?.url ??
      result.output?.results?.[0]?.image_url ??
      result.images?.[0]?.url ??
      result.data?.[0]?.url;
    const base64 =
      result.output?.results?.[0]?.base64 ??
      result.images?.[0]?.base64 ??
      result.data?.[0]?.b64_json;

    if (candidate) return fetchMedia(candidate);
    if (base64) return decodeBase64(base64);
    throw new Error("Qwen image API returned no image.");
  }

  if (provider === "cogview") {
    const url = `${config.cogviewApiBase}${config.cogviewApiPath}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cogviewApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.cogviewModel,
        prompt,
        n: 1,
        size: `${dimensions.width}x${dimensions.height}`,
      }),
    });
    const data = (await response.json()) as CogViewResponse;
    const candidate = data.data?.[0]?.url;
    const base64 = data.data?.[0]?.b64_json;

    if (!response.ok) {
      throw new ImageProviderError(
        "cogview",
        data.error?.code ?? "HttpError",
        `CogView image API error: ${JSON.stringify(data)}`
      );
    }

    if (candidate) return fetchMedia(candidate);
    if (base64) return decodeBase64(base64);
    throw new Error("CogView image API returned no image.");
  }

  if (
    provider === "pexels" ||
    provider === "pixabay" ||
    provider === "wikimedia" ||
    provider === "openverse" ||
    provider === "loc" ||
    provider === "smithsonian" ||
    provider === "europeana" ||
    provider === "internet_archive" ||
    provider === "baidu_image" ||
    provider === "so_image" ||
    provider === "stock"
  ) {
    return searchAndRankStockMedia(scene, provider, preferredCandidateId);
  }

  const size = pickOpenAISize(dimensions.width, dimensions.height);
  const response = await fetch(`${config.openaiBaseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiImageModel,
      prompt,
      size,
    }),
  });
  const data = (await response.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    error?: { code?: string; message?: string };
  };

  if (!response.ok) {
    throw new ImageProviderError(
      "openai",
      data.error?.code ?? "HttpError",
      `OpenAI image API error: ${JSON.stringify(data)}`
    );
  }
  const candidate = data.data?.[0]?.url;
  const base64 = data.data?.[0]?.b64_json;
  if (candidate) return fetchMedia(candidate);
  if (base64) return decodeBase64(base64);
  throw new Error("OpenAI image API returned no image.");
}
