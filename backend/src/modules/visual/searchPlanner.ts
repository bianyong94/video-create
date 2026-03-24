import type { ScriptScene } from "../../utils/json";
import type { AspectRatio } from "./visual.types";

export type SceneCategory =
  | "history"
  | "geography"
  | "movie"
  | "sports"
  | "technology"
  | "business"
  | "food"
  | "travel"
  | "person"
  | "general";

export type SearchProvider =
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
  | "so_image";

export type SearchCandidateMeta = {
  mediaType: "image" | "video";
  sourceProvider: SearchProvider;
  sourceUrl?: string;
  sourceAuthor?: string;
  title?: string;
  description?: string;
  tags?: string[];
  width?: number;
  height?: number;
  durationSec?: number;
  sourceQuery: string;
};

export type SearchMatchEvaluation = {
  matchScore: number;
  matchPassed: boolean;
  matchReasons: string[];
};

export type SceneSearchPlan = {
  category: SceneCategory;
  preferVideo: boolean;
  preferKnowledge: boolean;
  allowDocumentLike: boolean;
  isChinese: boolean;
  videoOnly: boolean;
  aspectRatio: AspectRatio;
  queryVariants: string[];
  providerOrder: SearchProvider[];
};

const CATEGORY_KEYWORDS: Record<SceneCategory, string[]> = {
  history: [
    "history",
    "historical",
    "ancient",
    "dynasty",
    "empire",
    "kingdom",
    "battle",
    "museum",
    "artifact",
    "archive",
    "antique",
    "历史",
    "古代",
    "王朝",
    "版图",
    "地图",
    "文物",
    "朝代",
    "战争",
  ],
  geography: [
    "map",
    "atlas",
    "border",
    "globe",
    "geography",
    "terrain",
    "satellite",
    "地图",
    "地理",
    "版图",
    "疆域",
    "边界",
  ],
  movie: [
    "movie",
    "film",
    "cinema",
    "scene",
    "trailer",
    "actor",
    "剧情",
    "电影",
    "影视",
    "片段",
    "解说",
  ],
  sports: [
    "sport",
    "sports",
    "basketball",
    "football",
    "soccer",
    "match",
    "stadium",
    "tennis",
    "体育",
    "篮球",
    "足球",
    "比赛",
    "球场",
  ],
  technology: [
    "technology",
    "tech",
    "ai",
    "robot",
    "chip",
    "startup",
    "device",
    "software",
    "科技",
    "人工智能",
    "芯片",
    "互联网",
  ],
  business: [
    "business",
    "company",
    "office",
    "finance",
    "market",
    "money",
    "economy",
    "商业",
    "财经",
    "金融",
    "企业",
    "公司",
  ],
  food: [
    "food",
    "cooking",
    "restaurant",
    "kitchen",
    "meal",
    "dish",
    "美食",
    "烹饪",
    "餐厅",
  ],
  travel: [
    "travel",
    "tourism",
    "city",
    "landmark",
    "beach",
    "mountain",
    "hotel",
    "旅行",
    "旅游",
    "景点",
    "城市",
  ],
  person: [
    "person",
    "people",
    "portrait",
    "interview",
    "speaker",
    "human",
    "人物",
    "采访",
    "肖像",
    "口播",
  ],
  general: [],
};

const CHINESE_STOPWORDS = new Set([
  "我们",
  "你们",
  "他们",
  "以及",
  "然后",
  "这个",
  "那个",
  "一种",
  "一些",
  "可以",
  "进行",
  "关于",
  "相关",
  "内容",
  "视频",
  "图片",
  "画面",
  "镜头",
]);

const VISUAL_NOISE_TERMS = [
  "镜头",
  "特写",
  "中景",
  "远景",
  "俯拍",
  "仰拍",
  "顶光",
  "暖光",
  "冷光",
  "光线",
  "灯笼",
  "构图",
  "摄影",
  "电影感",
  "写实",
  "cinematic",
  "photography",
  "lighting",
  "camera",
  "shot",
  "wide shot",
  "close up",
  "medium shot",
  "logo",
  "watermark",
  "text",
];

const HISTORY_ENTITY_TERMS = [
  "秦始皇",
  "统一六国",
  "郡县制",
  "中央集权",
  "中国地图",
  "中国版图",
  "中国疆域",
  "古代中国",
  "秦朝",
  "汉朝",
  "唐朝",
  "宋朝",
  "元朝",
  "明朝",
  "清朝",
  "诸侯国",
  "王朝",
  "版图",
  "疆域",
  "地图",
  "历史地图",
  "china",
  "qin dynasty",
  "qin shi huang",
  "historical map",
  "territory",
  "dynasty",
];

const HISTORY_STRONG_KEYWORDS = [
  "map",
  "atlas",
  "archive",
  "artifact",
  "museum",
  "historical",
  "ancient",
  "dynasty",
  "empire",
  "documentary",
  "footage",
  "history",
  "historical map",
  "map animation",
  "疆域",
  "版图",
  "地图",
  "历史",
  "王朝",
  "古代",
  "文物",
  "文献",
];

const HISTORY_NOISE_KEYWORDS = [
  "movie",
  "film",
  "music",
  "song",
  "ninja",
  "game",
  "amv",
  "edit",
  "trailer",
  "cosplay",
  "drama",
  "comedy",
  "reaction",
  "cover",
];

const CHINA_CORE_KEYWORDS = ["中国", "中华", "华夏", "china"];
const CHINA_CONFLICT_KEYWORDS = [
  "世界",
  "全球",
  "欧洲",
  "埃及",
  "日本",
  "美国",
  "罗马",
  "希腊",
  "印度",
  "法国",
  "英国",
  "德国",
  "俄国",
  "非洲",
  "中东",
  "world",
  "global",
  "europe",
  "egypt",
  "japan",
  "america",
  "roman",
  "greece",
  "india",
  "france",
  "britain",
  "germany",
  "russia",
  "africa",
  "middle east",
];
const MAP_CORE_KEYWORDS = ["版图", "疆域", "地图", "map", "atlas", "border"];
const DYNASTY_CORE_KEYWORDS = ["王朝", "朝代", "秦", "汉", "唐", "宋", "元", "明", "清", "dynasty", "empire"];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^A-Za-z0-9\u4e00-\u9fff\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function includesAny(text: string, keywords: string[]): number {
  return keywords.reduce(
    (count, keyword) => count + (text.includes(keyword) ? 1 : 0),
    0
  );
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function getCombinedText(scene: ScriptScene): string {
  return normalizeText(
    [scene.stock_query, scene.narration_text, scene.image_prompt]
      .filter(Boolean)
      .join(" ")
  );
}

function buildBaseQuery(scene: ScriptScene): string {
  return buildSceneSearchQuery(scene);
}

function rankChinesePhrase(phrase: string, source: string): number {
  let score = 0;
  if (phrase.length >= 2 && phrase.length <= 8) score += 4;
  if (source.includes(phrase)) score += 3;
  if (HISTORY_ENTITY_TERMS.some((term) => phrase.includes(term) || term.includes(phrase))) {
    score += 12;
  }
  if (MAP_CORE_KEYWORDS.some((term) => phrase.includes(term))) score += 8;
  if (CHINA_CORE_KEYWORDS.some((term) => phrase.includes(term))) score += 10;
  if (DYNASTY_CORE_KEYWORDS.some((term) => phrase.includes(term))) score += 8;
  if (VISUAL_NOISE_TERMS.some((term) => phrase.includes(term.toLowerCase()))) score -= 10;
  if (CHINESE_STOPWORDS.has(phrase)) score -= 8;
  return score;
}

function extractChineseFocusTerms(text: string): string[] {
  const normalized = normalizeText(text);
  const directTerms = HISTORY_ENTITY_TERMS.filter(
    (term) => /[\u4e00-\u9fff]/.test(term) && normalized.includes(term)
  );
  const tokenTerms = extractChineseTokens(normalized).filter(
    (term) => term.length >= 2 && term.length <= 6
  );
  const phrases = unique([...directTerms, ...tokenTerms]);
  const ranked = phrases
    .map((phrase) => ({ phrase, score: rankChinesePhrase(phrase, normalized) }))
    .filter((item) => item.score > 10)
    .sort((a, b) => b.score - a.score || b.phrase.length - a.phrase.length)
    .map((item) => item.phrase);

  const compressed: string[] = [];
  for (const phrase of ranked) {
    if (compressed.some((existing) => existing.includes(phrase) || phrase.includes(existing))) {
      continue;
    }
    compressed.push(phrase);
    if (compressed.length >= 6) break;
  }

  return compressed;
}

function extractEnglishFocusTerms(text: string): string[] {
  const normalized = normalizeText(text);
  return unique(
    normalized
      .split(" ")
      .filter((token) => token.length >= 3)
      .filter((token) => !VISUAL_NOISE_TERMS.includes(token))
      .filter((token) => !["video", "footage", "cinematic", "documentary", "animation", "shot"].includes(token))
  ).slice(0, 6);
}

export function buildSceneSearchQuery(scene: ScriptScene): string {
  const stockQuery = scene.stock_query?.trim() ?? "";
  const narration = scene.narration_text?.trim() ?? "";
  const prompt = scene.image_prompt?.trim() ?? "";
  const combined = [stockQuery, narration, prompt].filter(Boolean).join(" ");

  if (hasChinese(combined)) {
    const terms = unique([
      ...extractChineseFocusTerms(`${stockQuery} ${narration}`),
      ...extractChineseFocusTerms(narration),
      ...extractChineseFocusTerms(stockQuery),
      ...extractChineseFocusTerms(prompt),
    ]).slice(0, 6);

    if (terms.length) {
      return terms.join(" ").slice(0, 90);
    }
  }

  const englishTerms = unique([
    ...extractEnglishFocusTerms(stockQuery),
    ...extractEnglishFocusTerms(narration),
    ...extractEnglishFocusTerms(prompt),
  ]).slice(0, 6);

  if (englishTerms.length) {
    return englishTerms.join(" ").slice(0, 90);
  }

  return [narration, prompt]
    .join(" ")
    .replace(/[^A-Za-z0-9\u4e00-\u9fff\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function wantsDocumentLikeVisual(scene: ScriptScene): boolean {
  const combined = getCombinedText(scene);
  return /map|atlas|document|manuscript|scroll|artifact|coin|painting|portrait|diagram|blueprint|museum|地图|版图|疆域|文物|手稿|卷轴|古籍|画像|壁画|文献/i.test(
    combined
  );
}

export function classifyScene(scene: ScriptScene): SceneCategory {
  const combined = getCombinedText(scene);

  let bestCategory: SceneCategory = "general";
  let bestScore = 0;

  (Object.keys(CATEGORY_KEYWORDS) as SceneCategory[]).forEach((category) => {
    if (category === "general") return;
    const score = includesAny(combined, CATEGORY_KEYWORDS[category]);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  if (
    bestScore === 0 &&
    /人物|角色|传记|leader|founder|ceo|scientist/i.test(combined)
  ) {
    return "person";
  }

  return bestCategory;
}

function buildCategoryVariants(
  baseQuery: string,
  category: SceneCategory,
  isChinese: boolean
): string[] {
  const variants = [baseQuery];
  let englishFallback = "";

  if (category === "history") {
    englishFallback = "historical footage archive map animation documentary";
    variants.push(`${baseQuery} historical archive`);
    if (!/map|atlas|地图|版图/i.test(baseQuery)) {
      variants.push(`${baseQuery} historical map`);
    }
    variants.push(`${baseQuery} historical footage`);
    variants.push(`${baseQuery} archive footage`);
    variants.push(`${baseQuery} documentary footage`);
    variants.push(`${baseQuery} historical map animation`);
  } else if (category === "geography") {
    englishFallback = "map animation aerial footage documentary";
    variants.push(`${baseQuery} map`);
    variants.push(`${baseQuery} atlas`);
    variants.push(`${baseQuery} map animation`);
    variants.push(`${baseQuery} aerial footage`);
    variants.push(`${baseQuery} documentary footage`);
  } else if (category === "movie") {
    englishFallback = "film footage cinematic b roll";
    variants.push(`${baseQuery} cinematic footage`);
    variants.push(`${baseQuery} film scene`);
    variants.push(`${baseQuery} movie footage`);
    variants.push(`${baseQuery} cinematic b roll`);
    variants.push(`${baseQuery} trailer footage`);
  } else if (category === "sports") {
    englishFallback = "sports footage action shot stadium crowd";
    variants.push(`${baseQuery} action sports`);
    variants.push(`${baseQuery} stadium crowd`);
    variants.push(`${baseQuery} sports footage`);
    variants.push(`${baseQuery} action shot`);
    variants.push(`${baseQuery} match footage`);
  } else if (category === "technology") {
    englishFallback = "technology footage device close up documentary";
    variants.push(`${baseQuery} technology footage`);
    variants.push(`${baseQuery} device close up`);
    variants.push(`${baseQuery} tech b roll`);
    variants.push(`${baseQuery} lab footage`);
    variants.push(`${baseQuery} documentary footage`);
  } else if (category === "business") {
    englishFallback = "office meeting business footage corporate b roll";
    variants.push(`${baseQuery} office team`);
    variants.push(`${baseQuery} business meeting`);
    variants.push(`${baseQuery} corporate footage`);
    variants.push(`${baseQuery} business b roll`);
    variants.push(`${baseQuery} office footage`);
  } else if (category === "food") {
    englishFallback = "cooking footage food close up restaurant";
    variants.push(`${baseQuery} cooking close up`);
    variants.push(`${baseQuery} restaurant`);
    variants.push(`${baseQuery} food footage`);
    variants.push(`${baseQuery} cooking footage`);
    variants.push(`${baseQuery} kitchen b roll`);
  } else if (category === "travel") {
    englishFallback = "travel footage city skyline scenic b roll";
    variants.push(`${baseQuery} travel cinematic`);
    variants.push(`${baseQuery} landmark`);
    variants.push(`${baseQuery} travel footage`);
    variants.push(`${baseQuery} city skyline`);
    variants.push(`${baseQuery} scenic footage`);
  } else if (category === "person") {
    englishFallback = "interview portrait documentary footage";
    variants.push(`${baseQuery} documentary portrait`);
    variants.push(`${baseQuery} interview`);
    variants.push(`${baseQuery} interview footage`);
    variants.push(`${baseQuery} portrait footage`);
    variants.push(`${baseQuery} documentary footage`);
  } else {
    englishFallback = "cinematic footage b roll documentary";
    variants.push(`${baseQuery} cinematic`);
    variants.push(`${baseQuery} footage`);
    variants.push(`${baseQuery} b roll`);
    variants.push(`${baseQuery} documentary footage`);
    variants.push(`${baseQuery} stock video`);
  }

  if (isChinese && englishFallback) {
    variants.push(englishFallback);
    variants.push(`b站 ${baseQuery}`);
    variants.push(`哔哩哔哩 ${baseQuery}`);
  }

  return unique(
    variants
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 8)
  );
}

function getProviderOrder(
  category: SceneCategory,
  allowDocumentLike: boolean,
  isChinese: boolean
): SearchProvider[] {
  void category;
  void allowDocumentLike;
  void isChinese;
  return ["bilibili"];
}

function normalizeAspectRatio(value?: string): AspectRatio {
  return value === "landscape" ? "landscape" : "portrait";
}

export function buildSceneSearchPlan(
  scene: ScriptScene,
  aspectRatio: AspectRatio = "portrait"
): SceneSearchPlan {
  const category = classifyScene(scene);
  const baseQuery = buildBaseQuery(scene);
  const allowDocumentLike = wantsDocumentLikeVisual(scene);
  const preferKnowledge =
    (category === "history" || category === "geography") && allowDocumentLike;
  let preferVideo = category !== "person";
  if (preferKnowledge && category !== "movie") {
    preferVideo = false;
  }
  const isChinese = hasChinese(
    [scene.stock_query, scene.narration_text, scene.image_prompt, baseQuery]
      .filter(Boolean)
      .join(" ")
  );

  return {
    category,
    preferKnowledge,
    allowDocumentLike,
    preferVideo,
    isChinese,
    videoOnly: true,
    aspectRatio: normalizeAspectRatio(aspectRatio),
    queryVariants: buildCategoryVariants(baseQuery, category, isChinese),
    providerOrder: getProviderOrder(category, allowDocumentLike, isChinese),
  };
}

function extractChineseTokens(text: string): string[] {
  const seqs = (text.match(/[\u4e00-\u9fff]{2,}/g) ?? []).slice(0, 12);
  const tokens: string[] = [];

  for (const seq of seqs) {
    if (seq.length <= 4) {
      tokens.push(seq);
      continue;
    }

    for (let i = 0; i < seq.length - 1 && tokens.length < 28; i += 1) {
      const bi = seq.slice(i, i + 2);
      if (bi.length === 2 && !CHINESE_STOPWORDS.has(bi)) tokens.push(bi);
    }

    for (let i = 0; i < seq.length - 2 && tokens.length < 34; i += 1) {
      const tri = seq.slice(i, i + 3);
      if (tri.length === 3 && !CHINESE_STOPWORDS.has(tri)) tokens.push(tri);
    }
  }

  return tokens;
}

function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  const latinTokens = normalized
    .split(" ")
    .filter((token) => token.length >= 2)
    .slice(0, 20);

  const zhTokens = extractChineseTokens(normalized);
  return unique([...latinTokens, ...zhTokens]).slice(0, 36);
}

function buildMatchReasons(
  tokens: string[],
  matchedTokens: string[],
  candidate: SearchCandidateMeta,
  plan: SceneSearchPlan
): string[] {
  const reasons: string[] = [];
  const matchedCount = matchedTokens.length;
  const totalCount = Math.max(1, tokens.length);

  if (matchedCount > 0) {
    reasons.push(`词命中 ${matchedCount}/${totalCount}`);
  }

  if (candidate.mediaType === "video") {
    reasons.push("视频素材");
  }

  if (candidate.durationSec) {
    reasons.push(`时长约 ${Math.round(candidate.durationSec)} 秒`);
  }

  if (candidate.width && candidate.height) {
    const portrait = candidate.height >= candidate.width;
    reasons.push(portrait ? "竖向画幅" : "横向画幅");
  }

  if (plan.isChinese && /[\u4e00-\u9fff]/.test((candidate.title ?? "") + (candidate.description ?? ""))) {
    reasons.push("中文标题/描述");
  }

  if (plan.category === "history" || plan.category === "geography") {
    reasons.push("历史/地理题材");
  }

  return reasons.slice(0, 5);
}

export function evaluateSearchCandidate(
  candidate: SearchCandidateMeta,
  plan: SceneSearchPlan,
  scene: ScriptScene
): SearchMatchEvaluation {
  const haystack = normalizeText(
    [
      candidate.title,
      candidate.description,
      candidate.tags?.join(" "),
      candidate.sourceAuthor,
    ]
      .filter(Boolean)
      .join(" ")
  );
  const queryTokens = tokenize(
    [plan.queryVariants.join(" "), scene.stock_query, scene.narration_text]
      .filter(Boolean)
      .join(" ")
  );
  const matchedTokens = queryTokens.filter((token) => haystack.includes(token));
  const coverage = matchedTokens.length / Math.max(1, queryTokens.length);

  let score = 0;
  if (haystack) {
    score += Math.round(coverage * 45);
  }

  if (matchedTokens.length > 0) {
    score += Math.min(18, matchedTokens.length * 4);
  }

  if (candidate.mediaType === "video") {
    score += 10;
  }

  if (candidate.durationSec) {
    if (candidate.durationSec >= 3 && candidate.durationSec <= 20) score += 8;
    else if (candidate.durationSec > 45) score -= 4;
  }

  if (candidate.width && candidate.height) {
    const portrait = candidate.height >= candidate.width;
    if (plan.aspectRatio === "portrait" && portrait) score += 10;
    if (plan.aspectRatio === "landscape" && !portrait) score += 10;
    if (plan.aspectRatio === "portrait" && !portrait) score -= 8;
    if (plan.aspectRatio === "landscape" && portrait) score -= 8;
  }

  if (candidate.sourceProvider === "bilibili") score += 12;
  if (candidate.sourceProvider === "youtube") score += 10;

  if (plan.category === "history" || plan.category === "geography") {
    score += /map|atlas|archive|artifact|museum|historical|ancient|古代|历史|版图|疆域|地图|王朝/i.test(
      haystack
    )
      ? 12
      : 3;
  }

  if (plan.category === "movie" && /(film|movie|cinema|scene|trailer|电影|影视|片段)/i.test(haystack)) {
    score += 10;
  }

  if (
    plan.category === "sports" &&
    /(sport|stadium|basketball|football|soccer|tennis|体育|篮球|足球|比赛)/i.test(haystack)
  ) {
    score += 10;
  }

  if (plan.isChinese && /[\u4e00-\u9fff]/.test(haystack)) {
    score += 6;
  }

  if (plan.category === "history" || plan.category === "geography") {
    const hasStrongHistorySignal = HISTORY_STRONG_KEYWORDS.some((keyword) =>
      haystack.includes(keyword)
    );
    const hasNoiseSignal = HISTORY_NOISE_KEYWORDS.some((keyword) =>
      haystack.includes(keyword)
    );
    if (hasStrongHistorySignal) {
      score += 14;
    } else {
      score -= 10;
    }
    if (hasNoiseSignal) {
      score -= 18;
    }
    if (candidate.mediaType === "video" && !hasStrongHistorySignal) {
      score -= 6;
    }

    const sourceIntent = normalizeText(
      [scene.stock_query, scene.narration_text, scene.image_prompt]
        .filter(Boolean)
        .join(" ")
    );
    const wantsChina = CHINA_CORE_KEYWORDS.some((keyword) => sourceIntent.includes(keyword));
    const hasChina = CHINA_CORE_KEYWORDS.some((keyword) => haystack.includes(keyword));
    const hasChinaConflict = CHINA_CONFLICT_KEYWORDS.some((keyword) => haystack.includes(keyword));
    const wantsMap = MAP_CORE_KEYWORDS.some((keyword) => sourceIntent.includes(keyword));
    const hasMap = MAP_CORE_KEYWORDS.some((keyword) => haystack.includes(keyword));
    const wantsDynasty = DYNASTY_CORE_KEYWORDS.some((keyword) => sourceIntent.includes(keyword));
    const hasDynasty = DYNASTY_CORE_KEYWORDS.some((keyword) => haystack.includes(keyword));

    if (wantsChina) {
      if (hasChina) {
        score += 18;
      } else {
        score -= 20;
      }
      if (hasChinaConflict) {
        score -= 26;
      }
    }

    if (wantsMap) {
      if (hasMap) {
        score += 10;
      } else {
        score -= 12;
      }
    }

    if (wantsDynasty) {
      if (hasDynasty) {
        score += 8;
      } else {
        score -= 10;
      }
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    matchScore: score,
    matchPassed:
      score >= (plan.category === "history" || plan.category === "geography" ? 52 : 45),
    matchReasons: buildMatchReasons(queryTokens, matchedTokens, candidate, plan),
  };
}

function getProviderAffinity(
  provider: SearchProvider,
  category: SceneCategory,
  isChinese: boolean,
  aspectRatio: AspectRatio
): number {
  if (provider === "bilibili") {
    if (category === "history" || category === "geography" || category === "movie") {
      return 22;
    }
    return isChinese ? 18 : 8;
  }

  if (isChinese) {
    return 4;
  }

  return 0;
}

export function scoreSearchCandidate(
  candidate: SearchCandidateMeta,
  plan: SceneSearchPlan,
  scene: ScriptScene,
  matchEvaluation?: SearchMatchEvaluation
): number {
  const haystack = normalizeText(
    [
      candidate.title,
      candidate.description,
      candidate.tags?.join(" "),
      candidate.sourceAuthor,
    ]
      .filter(Boolean)
      .join(" ")
  );
  const queryTokens = tokenize(plan.queryVariants.join(" "));
  const sceneTokens = tokenize(
    [scene.stock_query, scene.narration_text].filter(Boolean).join(" ")
  );
  const evaluation =
    matchEvaluation ?? evaluateSearchCandidate(candidate, plan, scene);

  let score = getProviderAffinity(
    candidate.sourceProvider,
    plan.category,
    plan.isChinese,
    plan.aspectRatio
  );

  const tokenMatches = unique([...queryTokens, ...sceneTokens]).reduce(
    (count, token) => count + (haystack.includes(token) ? 1 : 0),
    0
  );
  score += Math.min(12, tokenMatches) * 7;

  if (plan.preferKnowledge) {
    score += candidate.mediaType === "image" ? 12 : -4;
  } else if (plan.preferVideo) {
    score += candidate.mediaType === "video" ? 28 : -10;
  }

  if (plan.videoOnly && candidate.mediaType !== "video") {
    score -= 200;
  }

  if (
    !plan.allowDocumentLike &&
    candidate.mediaType === "image" &&
    /(book|page|text|article|journal|newspaper|manuscript|scan|library|catalog|record|bulletin|document|古籍|书页|手稿|报纸|文献|文本|目录)/i.test(
      haystack
    )
  ) {
    score -= 80;
  }

  if (
    !plan.allowDocumentLike &&
    candidate.mediaType === "image"
  ) {
    score -= 100;
  }

  if (candidate.width && candidate.height) {
    const portrait = candidate.height >= candidate.width;
    if (plan.aspectRatio === "portrait" && portrait) score += 20;
    if (plan.aspectRatio === "landscape" && !portrait) score += 20;
    if (plan.aspectRatio === "portrait" && !portrait) score -= 18;
    if (plan.aspectRatio === "landscape" && portrait) score -= 18;
    if (portrait) score += 6;
    const pixels = candidate.width * candidate.height;
    score += Math.min(10, Math.round(Math.log10(Math.max(1, pixels))));
  }

  if (candidate.durationSec) {
    if (candidate.durationSec >= 3 && candidate.durationSec <= 20) score += 8;
    else if (candidate.durationSec > 45) score -= 4;
  }

  if (
    plan.category === "history" &&
    /(map|atlas|archive|artifact|museum|historical|ancient|古代|历史|版图|疆域|地图|王朝)/i.test(
      haystack
    )
  ) {
    score += plan.allowDocumentLike ? 14 : 4;
  }

  if (
    plan.category === "movie" &&
    /(film|movie|cinema|scene|trailer|电影|影视|片段)/i.test(haystack)
  ) {
    score += 10;
  }

  if (
    plan.category === "sports" &&
    /(sport|stadium|basketball|football|soccer|tennis|体育|篮球|足球|比赛)/i.test(
      haystack
    )
  ) {
    score += 10;
  }

  if (plan.isChinese && /[\u4e00-\u9fff]/.test(haystack)) {
    score += 8;
  }

  score += Math.round(evaluation.matchScore * 0.85);
  if (!evaluation.matchPassed) {
    score -= 18;
  }

  return score;
}
