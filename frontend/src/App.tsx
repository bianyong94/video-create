import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

type ScriptScene = {
  scene_id: number;
  narration_text: string;
  image_prompt: string;
  stock_query?: string;
  transition_text?: string;
};

type ScriptResponse = {
  scenes: ScriptScene[];
};

type AudioScene = {
  scene_id: number;
  narration_text: string;
  voice?: string;
  audio_path: string;
  duration_ms: number;
  timestamps: Array<{ text: string; begin_ms: number; end_ms: number }>;
};

type AudioResponse = {
  scenes: AudioScene[];
};

type VisualCandidate = {
  id: string;
  media_type: "image" | "video";
  media_url: string;
  preview_url?: string;
  preview_image_url?: string;
  preview_path?: string;
  clip_start_sec?: number;
  clip_end_sec?: number;
  transcript_match_score?: number;
  transcript_matched_text?: string;
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

type VisualScene = {
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

type VisualResponse = {
  scenes: VisualScene[];
};

type BaiduSearchResult = {
  title?: string;
  url?: string;
  snippet?: string;
  site?: string;
  source?: string;
  page_time?: string;
  media_kind?: "video" | "web";
  is_video_like?: boolean;
};

type BaiduSearchResponse = {
  query: string;
  count: number;
  results: BaiduSearchResult[];
};

type VideoCandidateResult = {
  id: string;
  media_type: "video" | "page";
  media_url: string;
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

type VideoCandidateResponse = {
  query: string;
  count: number;
  results: VideoCandidateResult[];
};

type VideoResponse = {
  video_path: string;
  srt_path: string;
  duration_ms: number;
  video_url?: string;
  srt_url?: string;
  subtitles_burned?: boolean;
};

type CommentarySegment = {
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
  status: "pending" | "ready" | "analyzing" | "failed";
  error?: string;
};

type CommentaryProject = {
  id: string;
  user_id: string;
  title: string;
  source_path: string;
  source_url?: string;
  duration_ms: number;
  status: "draft" | "imported" | "segmented" | "analyzing" | "ready" | "failed";
  segment_minutes: number;
  segments: CommentarySegment[];
  created_at: string;
  updated_at: string;
};

async function postJson<T>(path: string, body: unknown, headers?: HeadersInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? "请求失败");
  }
  return data as T;
}

async function getJson<T>(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? "请求失败");
  }
  return data as T;
}

function formatMs(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function safeHostname(url?: string): string {
  if (!url) return "example.com";
  try {
    return new URL(url).hostname;
  } catch {
    return "example.com";
  }
}

function isInlinePlayableMediaUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("/") ||
    url.startsWith("http://localhost") ||
    url.startsWith("https://localhost") ||
    url.startsWith("http://127.0.0.1") ||
    url.startsWith("https://127.0.0.1")
  );
}

function canPreviewAsVideo(url?: string): boolean {
  if (!url) return false;
  return (
    isInlinePlayableMediaUrl(url) &&
    !/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(url)
  );
}

type StepKey = "script" | "audio" | "visual" | "select" | "video";

export default function App() {
  const DEMO_USER_ID = "demo-user";
  const [commentaryTitle, setCommentaryTitle] = useState("");
  const [segmentMinutes, setSegmentMinutes] = useState(5);
  const [commentaryProject, setCommentaryProject] = useState<CommentaryProject | null>(null);
  const [commentaryFile, setCommentaryFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [topic, setTopic] = useState("古代中国版图变化");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sceneCount, setSceneCount] = useState(8);
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(2);
  const [narrationDensity, setNarrationDensity] = useState<
    "short" | "medium" | "long"
  >("medium");
  const [aspectRatio, setAspectRatio] = useState<"portrait" | "landscape">(
    "portrait"
  );

  const [voices, setVoices] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [voiceSampleText, setVoiceSampleText] = useState(
    "大家好，这是一段人声试听。"
  );
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);

  const [videoQuery, setVideoQuery] = useState(topic);
  const [videoCount, setVideoCount] = useState(8);
  const [videoResults, setVideoResults] = useState<VideoCandidateResult[]>([]);
  const [videoSearching, setVideoSearching] = useState(false);

  const [bgmStyles, setBgmStyles] = useState<string[]>([]);
  const [bgmStyle, setBgmStyle] = useState("default");
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmAiPrompt, setBgmAiPrompt] = useState("轻快、现代、科技感背景音乐");
  const [bgmPreviewUrl, setBgmPreviewUrl] = useState<string | null>(null);
  const [bgmPath, setBgmPath] = useState<string | null>(null);

  const [scriptResult, setScriptResult] = useState<ScriptResponse | null>(null);
  const [audioResult, setAudioResult] = useState<AudioResponse | null>(null);
  const [visualResult, setVisualResult] = useState<VisualResponse | null>(null);
  const [videoResult, setVideoResult] = useState<VideoResponse | null>(null);

  const [selectedByScene, setSelectedByScene] = useState<Record<number, string>>(
    {}
  );
  const [selectionDirty, setSelectionDirty] = useState(false);

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const didMountRef = useRef(false);
  const commentaryFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const voiceResp = await getJson<{ voices: string[] }>("/voice/list");
        setVoices(voiceResp.voices);
        if (voiceResp.voices.length > 0) {
          setSelectedVoice(voiceResp.voices[0]);
        }
      } catch {
        setVoices([]);
      }

      try {
        const musicResp = await getJson<{ styles: string[] }>("/music/styles");
        setBgmStyles(musicResp.styles);
        if (musicResp.styles.length > 0) {
          setBgmStyle(musicResp.styles[0]);
        }
      } catch {
        setBgmStyles([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setVideoResults([]);
    setVisualResult(null);
    setVideoResult(null);
    setSelectedByScene({});
    setSelectionDirty(false);
    setHint("画幅已切换，请重新生成候选素材和成片。");
  }, [aspectRatio]);

  const stepState = useMemo(() => {
    const states: Record<StepKey, "done" | "current" | "waiting"> = {
      script: "waiting",
      audio: "waiting",
      visual: "waiting",
      select: "waiting",
      video: "waiting",
    };

    if (scriptResult) states.script = "done";
    if (audioResult) states.audio = "done";
    if (visualResult) states.visual = "done";
    if (
      visualResult &&
      visualResult.scenes.every((scene) => selectedByScene[scene.scene_id])
    ) {
      states.select = selectionDirty ? "current" : "done";
    }
    if (videoResult) states.video = "done";

    if (!scriptResult) states.script = "current";
    else if (!audioResult) states.audio = "current";
    else if (!visualResult) states.visual = "current";
    else if (selectionDirty) states.select = "current";
    else if (!videoResult) states.video = "current";

    return states;
  }, [audioResult, scriptResult, selectionDirty, selectedByScene, videoResult, visualResult]);

  const candidateCompletion = useMemo(() => {
    if (!visualResult) return 0;
    const total = visualResult.scenes.length;
    if (!total) return 0;
    const selected = visualResult.scenes.filter(
      (scene) => selectedByScene[scene.scene_id]
    ).length;
    return Math.round((selected / total) * 100);
  }, [selectedByScene, visualResult]);

  const aspectRatioValue = aspectRatio === "landscape" ? "16 / 9" : "9 / 16";
  const studioStyle = useMemo(
    () =>
      ({ ["--candidate-aspect-ratio"]: aspectRatioValue } as CSSProperties),
    [aspectRatioValue]
  );

  async function handleVoicePreview() {
    setLoading("voice");
    setError(null);
    try {
      const result = await postJson<{ audio_url?: string }>("/voice/preview", {
        voice: selectedVoice || undefined,
        text: voiceSampleText || undefined,
      });
      setVoicePreviewUrl(result.audio_url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "试听失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleVideoSearch(queryOverride?: string) {
    const query = (queryOverride ?? videoQuery).trim();
    if (!query) {
      setError("请先输入视频检索关键词。");
      return;
    }

    setVideoSearching(true);
    setError(null);
    setHint(null);
    try {
      const result = await postJson<VideoCandidateResponse>("/search/video", {
        query,
        count: videoCount,
        aspect_ratio: aspectRatio,
      });
      setVideoResults(result.results ?? []);
      setHint(`视频检索完成，返回 ${result.count} 条候选。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "视频检索失败");
    } finally {
      setVideoSearching(false);
    }
  }

  async function handlePreviewBgm() {
    if (!bgmEnabled) return;
    setLoading("bgm");
    setError(null);
    try {
      const result = await postJson<{ bgm_url?: string }>("/music/generate", {
        style: bgmStyle,
      });
      setBgmPreviewUrl(result.bgm_url ?? null);
      setBgmPath(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "背景音乐试听失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleGenerateAiMusic() {
    if (!bgmAiPrompt.trim()) {
      setError("请先填写背景音乐提示词。");
      return;
    }
    setLoading("bgm-ai");
    setError(null);
    try {
      const result = await postJson<{ bgm_url?: string; bgm_path?: string }>(
        "/music/ai/generate",
        {
          prompt: bgmAiPrompt,
          style: bgmStyle !== "default" ? bgmStyle : undefined,
          title: "BGM",
          instrumental: true,
        }
      );
      setBgmPreviewUrl(result.bgm_url ?? null);
      setBgmPath(result.bgm_path ?? null);
      setBgmEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成 AI 背景音乐失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleScript() {
    setLoading("script");
    setError(null);
    setHint(null);
    try {
      const result = await postJson<ScriptResponse>("/script/generate", {
        topic,
        sourceUrl: sourceUrl || undefined,
        sceneCount,
        narrationDensity,
        targetDurationMinutes,
        aspect_ratio: aspectRatio,
      });
      setScriptResult(result);
      setAudioResult(null);
      setVisualResult(null);
      setVideoResult(null);
      setSelectedByScene({});
      setSelectionDirty(false);
      setHint("脚本已生成，下一步可以生成配音。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "脚本生成失败");
    } finally {
      setLoading(null);
    }
  }

  function handlePickCommentaryFile(file?: File | null) {
    if (!file) return;
    setCommentaryFile(file);
    if (!commentaryTitle.trim()) {
      const name = file.name.replace(/\.[^.]+$/, "");
      setCommentaryTitle(name);
    }
    setHint(`已选中文件：${file.name}`);
  }

  async function handleCreateCommentaryProject() {
    if (!commentaryFile) {
      setError("请先选择一个视频文件。");
      return;
    }
    setLoading("commentary-import");
    setError(null);
    setHint(null);
    try {
      const formData = new FormData();
      formData.append("file", commentaryFile);
      if (commentaryTitle.trim()) {
        formData.append("title", commentaryTitle.trim());
      }
      const response = await fetch(`${API_BASE}/commentary/projects/upload`, {
        method: "POST",
        headers: { "x-user-id": DEMO_USER_ID },
        body: formData,
      });
      const result = (await response.json()) as CommentaryProject | { error?: string };
      if (!response.ok) {
        throw new Error("error" in result ? result.error ?? "导入视频失败" : "导入视频失败");
      }
      setCommentaryProject(result as CommentaryProject);
      setHint("视频已导入，下一步可以自动切段。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入视频失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleSegmentCommentaryProject() {
    if (!commentaryProject) {
      setError("请先导入视频项目。");
      return;
    }
    setLoading("commentary-segment");
    setError(null);
    setHint(null);
    try {
      const result = await postJson<CommentaryProject>(
        `/commentary/projects/${commentaryProject.id}/segmentize`,
        { segmentMinutes }
      );
      setCommentaryProject(result);
      setHint("切段完成，下一步可以分析每段内容。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "视频切段失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleAnalyzeCommentaryProject() {
    if (!commentaryProject?.segments.length) {
      setError("请先完成导入和切段。");
      return;
    }
    setLoading("commentary-analyze");
    setError(null);
    setHint(null);
    try {
      const result = await postJson<CommentaryProject>(
        `/commentary/projects/${commentaryProject.id}/analyze`,
        {}
      );
      setCommentaryProject(result);
      setHint("片段分析完成，现在可以手动修改每段解说文案。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "片段分析失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleUpdateCommentarySegment(segmentId: string, patch: Partial<CommentarySegment>) {
    if (!commentaryProject) return;
    try {
      const response = await fetch(
        `${API_BASE}/commentary/projects/${commentaryProject.id}/segments/${segmentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "更新片段失败");
      }
      setCommentaryProject(data as CommentaryProject);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新片段失败");
    }
  }

  async function handleAudio() {
    if (!scriptResult) {
      setError("请先生成脚本。");
      return;
    }
    setLoading("audio");
    setError(null);
    setHint(null);
    try {
      const result = await postJson<AudioResponse>("/audio/generate", {
        scenes: scriptResult.scenes,
        voice: selectedVoice || undefined,
      });
      setAudioResult(result);
      setVideoResult(null);
      setHint("配音完成，下一步生成候选素材。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "配音生成失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleVisualCandidates() {
    if (!scriptResult) {
      setError("请先生成脚本。");
      return;
    }
    setLoading("visual");
    setError(null);
    setHint(null);
    try {
      const result = await postJson<VisualResponse>("/visual/generate", {
        scenes: scriptResult.scenes,
        aspect_ratio: aspectRatio,
      });
      const nextSelection: Record<number, string> = {};
      result.scenes.forEach((scene) => {
        const selected =
          scene.selected_candidate_id ?? scene.candidates?.[0]?.id ?? "";
        if (selected) {
          nextSelection[scene.scene_id] = selected;
        }
      });
      setVisualResult(result);
      setSelectedByScene(nextSelection);
      setSelectionDirty(false);
      setVideoResult(null);
      setHint("候选素材已生成，请逐镜头选择你满意的画面。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "候选素材生成失败");
    } finally {
      setLoading(null);
    }
  }

  function handleSelectCandidate(sceneId: number, candidateId: string) {
    setSelectedByScene((prev) => ({ ...prev, [sceneId]: candidateId }));
    setSelectionDirty(true);
  }

  function handleAutoPickVideo() {
    if (!visualResult) return;
    const nextSelection: Record<number, string> = {};
    visualResult.scenes.forEach((scene) => {
      const videoCandidate = scene.candidates?.find(
        (candidate) => candidate.media_type === "video"
      );
      const first = scene.candidates?.[0];
      const selectedId = videoCandidate?.id ?? first?.id;
      if (selectedId) {
        nextSelection[scene.scene_id] = selectedId;
      }
    });
    setSelectedByScene(nextSelection);
    setSelectionDirty(true);
    setHint("已自动优先选择视频素材，你可以继续手动微调。");
  }

  async function applySelections(silent = false): Promise<VisualResponse | null> {
    if (!scriptResult || !visualResult) {
      if (!silent) setError("请先生成候选素材。");
      return null;
    }
    const selections = visualResult.scenes
      .map((scene) => ({
        scene_id: scene.scene_id,
        candidate_id: selectedByScene[scene.scene_id],
      }))
      .filter((item) => Boolean(item.candidate_id));

    if (selections.length !== visualResult.scenes.length) {
      if (!silent) setError("还有镜头未选择素材，请先完成选择。");
      return null;
    }

    setLoading("apply");
    setError(null);
    if (!silent) setHint(null);
    try {
      const result = await postJson<VisualResponse>("/visual/generate", {
        scenes: scriptResult.scenes,
        selections,
        aspect_ratio: aspectRatio,
      });
      const nextSelection: Record<number, string> = {};
      result.scenes.forEach((scene) => {
        const selected =
          scene.selected_candidate_id ?? selectedByScene[scene.scene_id];
        if (selected) nextSelection[scene.scene_id] = selected;
      });
      setVisualResult(result);
      setSelectedByScene(nextSelection);
      setSelectionDirty(false);
      if (!silent) setHint("已应用镜头选择，素材已锁定。");
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "应用选择失败");
      return null;
    } finally {
      setLoading(null);
    }
  }

  async function handleAssembleVideo() {
    if (!scriptResult || !audioResult || !visualResult) {
      setError("请先完成脚本、配音和候选素材步骤。");
      return;
    }

    setLoading("video");
    setError(null);
    setHint(null);
    try {
      const materialized = selectionDirty
        ? await applySelections(true)
        : visualResult;
      if (!materialized) {
        throw new Error("素材选择尚未应用，请先应用后重试。");
      }

      const audioMap = new Map(
        audioResult.scenes.map((scene) => [scene.scene_id, scene])
      );
      const visualMap = new Map(
        materialized.scenes.map((scene) => [scene.scene_id, scene])
      );
      const mergedScenes = scriptResult.scenes.map((scene) => {
        const audio = audioMap.get(scene.scene_id);
        const visual = visualMap.get(scene.scene_id);
        if (!audio || !visual) {
          throw new Error(`场景 ${scene.scene_id} 缺少音频或视觉素材。`);
        }
        if (!visual.image_path && !visual.video_path) {
          throw new Error(`场景 ${scene.scene_id} 缺少可合成素材。`);
        }
        return {
          scene_id: scene.scene_id,
          image_path: visual.image_path,
          video_path: visual.video_path,
          audio_path: audio.audio_path,
          duration_ms: audio.duration_ms,
          timestamps: audio.timestamps,
        };
      });

      const result = await postJson<VideoResponse>("/video/assemble", {
        scenes: mergedScenes,
        bgm_style: bgmStyle,
        bgm_enabled: bgmEnabled,
        bgm_path: bgmPath ?? undefined,
        aspect_ratio: aspectRatio,
      });
      setVisualResult(materialized);
      setVideoResult(result);
      setHint("视频已生成，你可以直接预览结果。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "视频合成失败");
    } finally {
      setLoading(null);
    }
  }

  const stepList: Array<{ key: StepKey; label: string; desc: string }> = [
    { key: "script", label: "1. 脚本", desc: "生成更完整分镜" },
    { key: "audio", label: "2. 配音", desc: "语音与时间戳" },
    { key: "visual", label: "3. 候选素材", desc: "聚合搜索候选池" },
    { key: "select", label: "4. 人工挑选", desc: "逐镜头选择素材" },
    { key: "video", label: "5. 合成成片", desc: "锁定素材后输出" },
  ];

  return (
    <div className="studio-root" style={studioStyle}>
      <div className="studio-shell">
        <header className="studio-header">
          <div>
            <p className="studio-kicker">Semi Auto Studio</p>
            <h1>长视频解说工作台</h1>
            <p className="studio-subtitle">
              主流程先切到用户自有视频驱动。我们把导入、切段、转录、解说建议和人工微调先做扎实，旧的视频生成链路继续保留在下方。
            </p>
          </div>
          <div className="studio-api">API: {API_BASE}</div>
        </header>

        <section className="panel commentary-workbench-panel">
          <div className="panel-title-row">
            <h2>长视频解说工作台</h2>
            <p>支持拖拽或点击上传本地视频，先做导入、切段、分析与手动编辑。</p>
          </div>

          <div className="settings-grid commentary-settings-grid">
            <label>
              上传视频
              <div
                className={`upload-dropzone ${dragActive ? "drag-active" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget === event.target) {
                    setDragActive(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  handlePickCommentaryFile(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <input
                  ref={commentaryFileInputRef}
                  type="file"
                  accept="video/*"
                  className="upload-file-input"
                  onChange={(event) => handlePickCommentaryFile(event.target.files?.[0] ?? null)}
                />
                <div className="upload-dropzone-copy">
                  <strong>拖动视频到这里</strong>
                  <span>或点击按钮，从电脑中选择文件</span>
                </div>
                <button
                  type="button"
                  className="ui-btn ghost"
                  onClick={() => commentaryFileInputRef.current?.click()}
                >
                  选择视频文件
                </button>
                {commentaryFile ? (
                  <p className="tiny-tip">
                    当前文件：{commentaryFile.name} · {(commentaryFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                ) : (
                  <p className="tiny-tip">支持 mp4、mov、m4v、webm 等常见视频格式。</p>
                )}
              </div>
            </label>

            <label>
              项目标题
              <input
                className="ui-input"
                value={commentaryTitle}
                onChange={(event) => setCommentaryTitle(event.target.value)}
                placeholder="可选，不填则默认用文件名"
              />
            </label>

            <label>
              每段时长（分钟）
              <input
                className="ui-input"
                type="number"
                min={1}
                max={20}
                value={segmentMinutes}
                onChange={(event) => setSegmentMinutes(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="step-actions">
            <button className="ui-btn strong" onClick={() => void handleCreateCommentaryProject()} disabled={loading === "commentary-import"}>
              {loading === "commentary-import" ? "导入中..." : "1. 导入本地视频"}
            </button>
            <button className="ui-btn" onClick={() => void handleSegmentCommentaryProject()} disabled={!commentaryProject || loading === "commentary-segment"}>
              {loading === "commentary-segment" ? "切段中..." : "2. 自动切段"}
            </button>
            <button className="ui-btn" onClick={() => void handleAnalyzeCommentaryProject()} disabled={!commentaryProject?.segments.length || loading === "commentary-analyze"}>
              {loading === "commentary-analyze" ? "分析中..." : "3. 分析片段"}
            </button>
          </div>

          {!commentaryProject && (
            <div className="empty-block">
              先拖拽或选择一个本地长视频，再进入切段和分析。后续我们再补云端上传与在线素材管理。
            </div>
          )}

          {commentaryProject && (
            <div className="scene-list">
              <article className="scene-card commentary-project-card">
                <header className="scene-head">
                  <div>
                    <h3>{commentaryProject.title}</h3>
                    <p>{commentaryProject.source_path}</p>
                  </div>
                  <div className="scene-meta">
                    <span className="meta-pill">{commentaryProject.status}</span>
                    <span className="meta-pill light">总时长 {formatMs(commentaryProject.duration_ms)}</span>
                    <span className="meta-pill light">共 {commentaryProject.segments.length} 段</span>
                  </div>
                </header>
              </article>

              {commentaryProject.segments.map((segment) => (
                <article key={segment.id} className="scene-card commentary-segment-card">
                  <header className="scene-head">
                    <div>
                      <h3>{segment.title}</h3>
                      <p>
                        {formatMs(segment.start_ms)} - {formatMs(segment.end_ms)} · {formatMs(segment.duration_ms)}
                      </p>
                    </div>
                    <div className="scene-meta">
                      <span className="meta-pill">{segment.status}</span>
                      {segment.error ? <span className="meta-pill warn">需处理</span> : null}
                      {segment.keep_original_audio ? <span className="meta-pill light">保留原声</span> : null}
                    </div>
                  </header>

                  <div className="commentary-grid">
                    <div className="mini-card commentary-preview-card">
                      <h3>片段预览</h3>
                      {segment.source_url ? (
                        <video controls src={segment.source_url} />
                      ) : (
                        <div className="empty-inline">暂时没有可访问预览</div>
                      )}
                    </div>

                    <div className="mini-card commentary-text-card">
                      <h3>转录文本</h3>
                      <p>{segment.transcript_text ?? "等待分析"}</p>
                      {segment.error ? <p className="warn-text">{segment.error}</p> : null}
                    </div>

                    <div className="mini-card commentary-text-card">
                      <h3>内容摘要</h3>
                      <textarea
                        className="ui-input commentary-textarea"
                        value={segment.transcript_summary ?? ""}
                        onChange={(event) =>
                          void handleUpdateCommentarySegment(segment.id, {
                            transcript_summary: event.target.value,
                          })
                        }
                        placeholder="分析后会生成摘要，这里可以手动修改。"
                      />
                    </div>

                    <div className="mini-card commentary-text-card">
                      <h3>解说文案</h3>
                      <textarea
                        className="ui-input commentary-textarea"
                        value={segment.commentary_text ?? ""}
                        onChange={(event) =>
                          void handleUpdateCommentarySegment(segment.id, {
                            commentary_text: event.target.value,
                          })
                        }
                        placeholder="这里会生成解说建议，适合人工继续润色。"
                      />
                      {segment.highlight_text ? (
                        <p className="candidate-hint">精彩点建议：{segment.highlight_text}</p>
                      ) : null}
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={segment.keep_original_audio}
                          onChange={(event) =>
                            void handleUpdateCommentarySegment(segment.id, {
                              keep_original_audio: event.target.checked,
                            })
                          }
                        />
                        该段优先保留原声
                      </label>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel settings-panel">
          <div className="panel-title-row">
            <h2>旧版自动生成实验区</h2>
            <p>保留原有脚本、配音、候选素材与合成功能，便于继续实验和对比。</p>
          </div>

          <div className="settings-grid">
            <label>
              主题
              <input
                className="ui-input"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              />
            </label>

            <label>
              参考链接（可选）
              <input
                className="ui-input"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </label>

            <label>
              分镜数量
              <input
                className="ui-input"
                type="number"
                min={3}
                max={120}
                value={sceneCount}
                onChange={(event) => setSceneCount(Number(event.target.value))}
              />
            </label>

            <label>
              目标时长（分钟）
              <input
                className="ui-input"
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                value={targetDurationMinutes}
                onChange={(event) =>
                  setTargetDurationMinutes(Number(event.target.value))
                }
              />
            </label>

            <label>
              文案密度
              <select
                className="ui-input"
                value={narrationDensity}
                onChange={(event) =>
                  setNarrationDensity(
                    event.target.value as "short" | "medium" | "long"
                  )
                }
              >
                <option value="short">短</option>
                <option value="medium">中</option>
                <option value="long">长</option>
              </select>
            </label>

            <label>
              人声
              <select
                className="ui-input"
                value={selectedVoice}
                onChange={(event) => setSelectedVoice(event.target.value)}
              >
                {voices.length === 0 && <option value="">暂无可选</option>}
                {voices.map((voice) => (
                  <option key={voice} value={voice}>
                    {voice}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ratio-card">
            <div>
              <h3>画幅</h3>
              <p>只选横屏或竖屏，后续候选、预览和最终成片都会统一这个比例。</p>
            </div>
            <div className="ratio-switch">
              <button
                type="button"
                className={`ratio-option ${aspectRatio === "portrait" ? "active" : ""}`}
                onClick={() => setAspectRatio("portrait")}
              >
                竖屏 9:16
              </button>
              <button
                type="button"
                className={`ratio-option ${aspectRatio === "landscape" ? "active" : ""}`}
                onClick={() => setAspectRatio("landscape")}
              >
                横屏 16:9
              </button>
            </div>
          </div>

          <div className="settings-subgrid">
            <div className="mini-card">
              <h3>人声试听</h3>
              <input
                className="ui-input"
                value={voiceSampleText}
                onChange={(event) => setVoiceSampleText(event.target.value)}
              />
              <button
                className="ui-btn ghost"
                onClick={handleVoicePreview}
                disabled={loading === "voice"}
              >
                {loading === "voice" ? "试听中..." : "试听人声"}
              </button>
              {voicePreviewUrl && <audio controls src={voicePreviewUrl} />}
            </div>

            <div className="mini-card">
              <h3>背景音乐</h3>
              <div className="row-inline">
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={bgmEnabled}
                    onChange={(event) => setBgmEnabled(event.target.checked)}
                  />
                  启用背景音乐
                </label>
              </div>
              <select
                className="ui-input"
                value={bgmStyle}
                onChange={(event) => setBgmStyle(event.target.value)}
                disabled={!bgmEnabled}
              >
                {bgmStyles.length === 0 && <option value="default">default</option>}
                {bgmStyles.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
              <div className="row-inline">
                <button
                  className="ui-btn ghost"
                  onClick={handlePreviewBgm}
                  disabled={!bgmEnabled || loading === "bgm"}
                >
                  {loading === "bgm" ? "加载中..." : "试听风格 BGM"}
                </button>
              </div>
              <input
                className="ui-input"
                value={bgmAiPrompt}
                onChange={(event) => setBgmAiPrompt(event.target.value)}
                placeholder="AI 背景音乐描述"
              />
              <button
                className="ui-btn ghost"
                onClick={handleGenerateAiMusic}
                disabled={loading === "bgm-ai"}
              >
                {loading === "bgm-ai" ? "生成中..." : "生成 AI BGM"}
              </button>
              {bgmPreviewUrl && <audio controls src={bgmPreviewUrl} />}
              {bgmPath && <p className="tiny-tip">已使用 AI 音乐路径</p>}
            </div>
          </div>
        </section>

        <section className="panel search-panel">
          <div className="panel-title-row">
            <h2>视频检索测试</h2>
            <p>优先看 B 站公开视频，再补充其他公开视频源，先验证关键词命中情况</p>
          </div>

          <div className="search-test-grid">
            <label>
              检索关键词
              <input
                className="ui-input"
                value={videoQuery}
                onChange={(event) => setVideoQuery(event.target.value)}
                placeholder="例如：古代中国版图变化"
              />
            </label>
            <label>
              返回数量
              <input
                className="ui-input"
                type="number"
                min={1}
                max={20}
                value={videoCount}
                onChange={(event) => setVideoCount(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="step-actions">
            <button
              className="ui-btn strong"
              onClick={() => void handleVideoSearch()}
              disabled={videoSearching}
            >
              {videoSearching ? "检索中..." : "视频检索测试"}
            </button>
            <button
              className="ui-btn ghost"
              onClick={() => {
                setVideoQuery(topic);
                void handleVideoSearch(topic);
              }}
              disabled={videoSearching}
            >
              用当前主题测试
            </button>
          </div>

          {videoResults.length > 0 ? (
            <div className="video-results">
              {videoResults.map((item, index) => (
                <article key={`${item.id ?? item.media_url ?? index}`} className="video-result-card">
                  <div className="candidate-preview">
                    {item.media_type === "video" ? (
                      item.preview_url && canPreviewAsVideo(item.preview_url) ? (
                        <video
                          src={item.preview_url}
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="metadata"
                        />
                      ) : item.preview_image_url ? (
                        <img src={item.preview_image_url} alt={item.title ?? "视频候选"} />
                      ) : (
                        <div className="candidate-placeholder">
                          <div className="placeholder-kind">VIDEO</div>
                          <div className="placeholder-title">
                            {item.title || item.source_provider}
                          </div>
                          <div className="placeholder-subtitle">暂时没有可直接预览的画面</div>
                        </div>
                      )
                    ) : (
                      <img
                        src={item.preview_image_url ?? `https://www.google.com/s2/favicons?domain=${safeHostname(item.page_url ?? item.media_url)}&sz=64`}
                        alt={item.title ?? "页面候选"}
                      />
                    )}
                  </div>
                  <div className="candidate-info">
                    <div className="candidate-line">
                      <span className="meta-pill light">
                        {item.media_type === "video" ? "VIDEO" : "PAGE"}
                      </span>
                      <span className="meta-pill light">{item.source_provider}</span>
                      {typeof item.match_score === "number" && (
                        <span className={`meta-pill ${item.match_passed ? "" : "warn"}`}>
                          匹配 {Math.round(item.match_score)}
                        </span>
                      )}
                      {item.duration_sec ? (
                        <span className="meta-pill light">
                          {formatMs(item.duration_sec * 1000)}
                        </span>
                      ) : null}
                      <span className="score">#{Math.round(item.score)}</span>
                    </div>
                    <h3>{item.title || "未命名结果"}</h3>
                    {(item.description || item.page_snippet) && (
                      <p>{item.description ?? item.page_snippet}</p>
                    )}
                    {item.match_reasons?.length ? (
                      <p className="candidate-hint">
                        {item.match_reasons.slice(0, 2).join(" · ")}
                      </p>
                    ) : null}
                    {item.transcript_matched_text ? (
                      <p className="candidate-hint">
                        字幕命中：{item.transcript_matched_text}
                      </p>
                    ) : null}
                    {typeof item.clip_start_sec === "number" && typeof item.clip_end_sec === "number" ? (
                      <p className="candidate-hint">
                        片段建议：{formatMs(item.clip_start_sec * 1000)} - {formatMs(item.clip_end_sec * 1000)}
                      </p>
                    ) : null}
                    {item.source_url && item.media_type === "video" && (
                      <a href={item.source_url} target="_blank" rel="noreferrer">
                        打开来源
                      </a>
                    )}
                    {item.media_type === "page" && item.page_url && (
                      <a href={item.page_url} target="_blank" rel="noreferrer">
                        打开页面
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-block">
              这里会显示检索到的视频候选，方便你直接判断关键词是否有效。
            </div>
          )}
        </section>

        {error && <div className="notice error">{error}</div>}
        {hint && <div className="notice hint">{hint}</div>}

        <section className="panel steps-panel">
          <div className="panel-title-row">
            <h2>制作流程</h2>
            <p>按步骤推进，每一步都可检查与重做</p>
          </div>

          <div className="step-badges">
            {stepList.map((step) => (
              <div key={step.key} className={`step-badge ${stepState[step.key]}`}>
                <div className="step-name">{step.label}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
            ))}
          </div>

          <div className="step-actions">
            <button
              className="ui-btn"
              onClick={handleScript}
              disabled={loading === "script"}
            >
              {loading === "script" ? "生成中..." : "生成脚本"}
            </button>
            <button
              className="ui-btn"
              onClick={handleAudio}
              disabled={!scriptResult || loading === "audio"}
            >
              {loading === "audio" ? "生成中..." : "生成配音"}
            </button>
            <button
              className="ui-btn"
              onClick={handleVisualCandidates}
              disabled={!scriptResult || loading === "visual"}
            >
              {loading === "visual" ? "生成中..." : "生成候选素材"}
            </button>
            <button
              className="ui-btn ghost"
              onClick={() => void applySelections()}
              disabled={!visualResult || loading === "apply"}
            >
              {loading === "apply" ? "应用中..." : "应用镜头选择"}
            </button>
            <button
              className="ui-btn strong"
              onClick={handleAssembleVideo}
              disabled={!visualResult || !audioResult || loading === "video"}
            >
              {loading === "video" ? "合成中..." : "合成最终视频"}
            </button>
          </div>
        </section>

        <section className="panel scene-panel">
          <div className="panel-title-row">
            <h2>镜头候选素材池</h2>
            <p>
              每个镜头从多源候选里人工选最合适素材。当前完成度：
              <strong> {candidateCompletion}%</strong>
            </p>
          </div>

          <div className="scene-toolbar">
            <button
              className="ui-btn ghost"
              onClick={handleAutoPickVideo}
              disabled={!visualResult}
            >
              自动优先选视频
            </button>
            {selectionDirty && <span className="tiny-tip">你有未应用的镜头选择</span>}
          </div>

          {!visualResult && (
            <div className="empty-block">
              先执行“生成候选素材”，这里会出现逐镜头候选卡片。
            </div>
          )}

          {visualResult && (
            <div className="scene-list">
              {visualResult.scenes.map((scene) => (
                <article key={scene.scene_id} className="scene-card">
                  <header className="scene-head">
                    <div>
                      <h3>Scene {scene.scene_id}</h3>
                      <p>{scene.image_prompt}</p>
                    </div>
                    <div className="scene-meta">
                      {scene.scene_category && (
                        <span className="meta-pill">{scene.scene_category}</span>
                      )}
                      {scene.source_provider && (
                        <span className="meta-pill">{scene.source_provider}</span>
                      )}
                    </div>
                  </header>

                  <p className="scene-narration">
                    {scriptResult?.scenes.find((item) => item.scene_id === scene.scene_id)
                      ?.narration_text ?? "无旁白"}
                  </p>

                  <div className="candidate-grid">
                    {(scene.candidates ?? []).map((candidate) => {
                      const selected = selectedByScene[scene.scene_id] === candidate.id;
                      return (
                        <button
                          type="button"
                          key={candidate.id}
                          className={`candidate-card ${selected ? "selected" : ""}`}
                          onClick={() =>
                            handleSelectCandidate(scene.scene_id, candidate.id)
                          }
                        >
                          <div className="candidate-preview">
                            {candidate.media_type === "video" ? (
                              candidate.preview_url && canPreviewAsVideo(candidate.preview_url) ? (
                                <video
                                  src={candidate.preview_url}
                                  autoPlay
                                  muted
                                  loop
                                  playsInline
                                  preload="metadata"
                                />
                              ) : candidate.preview_image_url ? (
                                <img
                                  src={candidate.preview_image_url}
                                  alt={candidate.title ?? "candidate"}
                                />
                              ) : isInlinePlayableMediaUrl(candidate.media_url) ? (
                                <video
                                  src={candidate.media_url}
                                  autoPlay
                                  muted
                                  loop
                                  playsInline
                                  preload="metadata"
                                />
                              ) : (
                                <div className="candidate-placeholder">
                                  <div className="placeholder-kind">VIDEO</div>
                                  <div className="placeholder-title">
                                    {candidate.title || candidate.source_provider}
                                  </div>
                                  <div className="placeholder-subtitle">
                                    外链视频不直接嵌入，避免浏览器阻断
                                  </div>
                                </div>
                              )
                            ) : (
                              <img src={candidate.media_url} alt={candidate.title ?? "candidate"} />
                            )}
                          </div>
                          <div className="candidate-info">
                            <div className="candidate-line">
                              <span className="meta-pill light">
                                {candidate.media_type.toUpperCase()}
                              </span>
                              <span className="meta-pill light">
                                {candidate.source_provider}
                              </span>
                              {typeof candidate.match_score === "number" && (
                                <span className={`meta-pill ${candidate.match_passed ? "" : "warn"}`}>
                                  匹配 {Math.round(candidate.match_score)}
                                </span>
                              )}
                              <span className="score">#{Math.round(candidate.score)}</span>
                            </div>
                            <p className="candidate-title">
                              {candidate.title || candidate.description || "未提供标题"}
                            </p>
                            {candidate.match_reasons?.length ? (
                              <p className="candidate-hint">
                                {candidate.match_reasons.slice(0, 2).join(" · ")}
                              </p>
                            ) : null}
                            {candidate.transcript_matched_text ? (
                              <p className="candidate-hint">
                                字幕命中：{candidate.transcript_matched_text}
                              </p>
                            ) : null}
                            {typeof candidate.clip_start_sec === "number" && typeof candidate.clip_end_sec === "number" ? (
                              <p className="candidate-hint">
                                片段建议：{formatMs(candidate.clip_start_sec * 1000)} - {formatMs(candidate.clip_end_sec * 1000)}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {(scene.candidates ?? []).length === 0 && (
                    <div className="empty-inline">本镜头未返回候选素材。</div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel output-panel">
          <div className="panel-title-row">
            <h2>成片输出</h2>
            <p>
              时长：
              <strong>
                {videoResult ? ` ${formatMs(videoResult.duration_ms)}` : " --:--"}
              </strong>
            </p>
          </div>

          {!videoResult && (
            <div className="empty-block">
              完成镜头选择后点击“合成最终视频”，这里会展示结果。
            </div>
          )}

          {videoResult && (
            <div className="video-preview-card">
              {videoResult.video_url ? (
                <video controls src={videoResult.video_url} />
              ) : (
                <div className="empty-inline">视频已生成，但未返回可直接访问的 URL。</div>
              )}
              <div className="video-meta">
                <p>视频路径：{videoResult.video_path}</p>
                <p>SRT 路径：{videoResult.srt_path}</p>
                {videoResult.subtitles_burned === false && (
                  <p className="warn-text">
                    本次导出触发了无字幕兜底，建议调整字体或 ffmpeg 字幕参数后重试。
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
