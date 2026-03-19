import { getSearchConfig } from "../../config/env";
import type { BaiduSearchInput, BaiduSearchResult } from "./baiduSearch.types";

type BaiduSearchApiResponse = {
  code?: number | string;
  message?: string;
  references?: BaiduSearchResult[];
  data?: BaiduSearchResult[];
  result?: BaiduSearchResult[];
};

const VIDEO_DOMAIN_RE =
  /(?:youtube\.com|youtu\.be|bilibili\.com|v\.qq\.com|iqiyi\.com|youku\.com|mgtv\.com|douyin\.com|xigua\.com|kuaishou\.com|vimeo\.com|ted\.com|sohu\.com|163\.com)/i;
const VIDEO_PATH_RE = /\.(mp4|m3u8|webm|mov)(?:$|\?)/i;

function clampCount(count?: number): number {
  if (!Number.isFinite(count)) return 10;
  return Math.min(50, Math.max(1, Math.trunc(count ?? 10)));
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildFreshnessFilter(freshness?: string): Record<string, unknown> | undefined {
  if (!freshness) return undefined;

  const normalized = freshness.trim();
  if (!normalized) return undefined;

  const preset = normalized.toLowerCase();
  const now = new Date();
  const endDate = formatLocalDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  if (preset === "pd" || preset === "pw" || preset === "pm" || preset === "py") {
    const days =
      preset === "pd" ? 1 : preset === "pw" ? 6 : preset === "pm" ? 30 : 364;
    const startDate = formatLocalDate(
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    );
    return { range: { page_time: { gte: startDate, lt: endDate } } };
  }

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})to(\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    throw new Error(
      `freshness must be pd/pw/pm/py or YYYY-MM-DDtoYYYY-MM-DD, got: ${freshness}`
    );
  }

  return { range: { page_time: { gte: match[1], lt: match[2] } } };
}

function isVideoLikeResult(result: BaiduSearchResult): boolean {
  const text = [result.title, result.url, result.snippet]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (VIDEO_PATH_RE.test(text)) return true;
  return VIDEO_DOMAIN_RE.test(text) || /视频|影片|片段|直播|预告|短片/.test(text);
}

export async function searchBaiduWeb(
  input: BaiduSearchInput
): Promise<BaiduSearchResult[]> {
  const { baiduApiKey } = getSearchConfig();
  const count = clampCount(input.count);
  const searchFilter = buildFreshnessFilter(input.freshness);

  const requestBody: Record<string, unknown> = {
    messages: [
      {
        role: "user",
        content: input.query,
      },
    ],
    search_source: "baidu_search_v2",
    resource_type_filter: [{ type: "web", top_k: count }],
  };

  if (searchFilter) {
    requestBody.search_filter = searchFilter;
  }

  const response = await fetch("https://qianfan.baidubce.com/v2/ai_search/web_search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${baiduApiKey}`,
      "X-Appbuilder-From": "openclaw",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const data = (await response.json()) as BaiduSearchApiResponse;

  if (!response.ok) {
    throw new Error(
      `Baidu search API error: ${response.status} ${JSON.stringify(data)}`
    );
  }

  if (data.code) {
    throw new Error(data.message || `Baidu search API returned code ${data.code}`);
  }

  const results = data.references ?? data.data ?? data.result ?? [];
  return results
    .filter(Boolean)
    .map((item) => {
      const videoLike = isVideoLikeResult(item);
      return {
        ...item,
        snippet: typeof item.snippet === "string" ? item.snippet : undefined,
        is_video_like: videoLike,
        media_kind: videoLike ? "video" : "web",
      } satisfies BaiduSearchResult;
    });
}
