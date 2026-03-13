import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

type ScriptScene = {
  scene_id: number;
  narration_text: string;
  image_prompt: string;
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

type VisualScene = {
  scene_id: number;
  image_prompt: string;
  image_path: string;
  width: number;
  height: number;
};

type VisualResponse = {
  scenes: VisualScene[];
};

type VideoResponse = {
  video_path: string;
  srt_path: string;
  duration_ms: number;
  video_url?: string;
  srt_url?: string;
  subtitles_burned?: boolean;
};

type JobStatus = {
  stage: string;
  progress: number;
  message: string;
  result?: unknown;
  error?: string;
  failedStage?: "script" | "audio" | "visual" | "video";
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

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function stringifyPretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function App() {
  const [topic, setTopic] = useState("AI 自动视频工厂");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sceneCount, setSceneCount] = useState(6);

  const [scriptResult, setScriptResult] = useState<ScriptResponse | null>(null);
  const [scriptText, setScriptText] = useState("");
  const [audioResult, setAudioResult] = useState<AudioResponse | null>(null);
  const [audioText, setAudioText] = useState("");
  const [visualResult, setVisualResult] = useState<VisualResponse | null>(null);
  const [visualText, setVisualText] = useState("");
  const [videoResult, setVideoResult] = useState<VideoResponse | null>(null);
  const [videoText, setVideoText] = useState("");

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [voiceSampleText, setVoiceSampleText] = useState("大家好，这是一段人声试听。");
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [bgmStyles, setBgmStyles] = useState<string[]>([]);
  const [bgmStyle, setBgmStyle] = useState("default");
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [bgmPreviewUrl, setBgmPreviewUrl] = useState<string | null>(null);
  const [bgmAiPrompt, setBgmAiPrompt] = useState("轻快、现代、科技感背景音乐");
  const [bgmAiStatus, setBgmAiStatus] = useState("");
  const [bgmPath, setBgmPath] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const status = await getJson<JobStatus>(`/orchestrator/status/${jobId}`);
        setJobStatus(status);
        if (status.result) {
          const result = status.result as {
            script?: ScriptResponse;
            audio?: AudioResponse;
            visual?: VisualResponse;
            video?: VideoResponse;
          };
          if (result.script) {
            setScriptResult(result.script);
            setScriptText(stringifyPretty(result.script));
          }
          if (result.audio) {
            setAudioResult(result.audio);
            setAudioText(stringifyPretty(result.audio));
          }
          if (result.visual) {
            setVisualResult(result.visual);
            setVisualText(stringifyPretty(result.visual));
          }
          if (result.video) {
            setVideoResult(result.video);
            setVideoText(stringifyPretty(result.video));
          }
        }
        if (status.stage === "completed" || status.stage === "failed") {
          if (timer) window.clearInterval(timer);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "查询失败");
      }
    };
    poll();
    timer = window.setInterval(poll, 2000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [jobId]);

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

  const mergedVideoInput = useMemo(() => {
    if (!scriptResult || !audioResult || !visualResult) return null;
    const audioMap = new Map(audioResult.scenes.map((s) => [s.scene_id, s]));
    const visualMap = new Map(visualResult.scenes.map((s) => [s.scene_id, s]));
    const scenes = scriptResult.scenes.map((scene) => {
      const audio = audioMap.get(scene.scene_id);
      const visual = visualMap.get(scene.scene_id);
      return {
        scene_id: scene.scene_id,
        image_path: visual?.image_path ?? "",
        audio_path: audio?.audio_path ?? "",
        duration_ms: audio?.duration_ms ?? 0,
        timestamps: audio?.timestamps ?? [],
      };
    });
    return {
      scenes,
      bgm_style: bgmStyle,
      bgm_enabled: bgmEnabled,
      bgm_path: bgmPath ?? undefined,
    };
  }, [scriptResult, audioResult, visualResult, bgmStyle, bgmEnabled, bgmPath]);

  async function handleScript() {
    setLoading("script");
    setError(null);
    try {
      const result = await postJson<ScriptResponse>("/script/generate", {
        topic,
        sourceUrl: sourceUrl || undefined,
        sceneCount,
      });
      setScriptResult(result);
      setScriptText(stringifyPretty(result));
      setAudioText(stringifyPretty(result.scenes));
      setVisualText(stringifyPretty(result.scenes));
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleAudio() {
    setLoading("audio");
    setError(null);
    const scenes = safeParseJson<ScriptScene[]>(audioText);
    if (!scenes) {
      setError("音频输入不是合法 JSON 数组");
      setLoading(null);
      return;
    }
    try {
      const result = await postJson<AudioResponse>("/audio/generate", {
        scenes,
        voice: selectedVoice || undefined,
      });
      setAudioResult(result);
      setAudioText(stringifyPretty(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleVisual() {
    setLoading("visual");
    setError(null);
    const scenes = safeParseJson<ScriptScene[]>(visualText);
    if (!scenes) {
      setError("画面输入不是合法 JSON 数组");
      setLoading(null);
      return;
    }
    try {
      const result = await postJson<VisualResponse>("/visual/generate", { scenes });
      setVisualResult(result);
      setVisualText(stringifyPretty(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleVideo() {
    setLoading("video");
    setError(null);
    const payload = safeParseJson<{ scenes: Array<Record<string, unknown>> }>(
      videoText
    );
    if (!payload) {
      setError("视频输入不是合法 JSON");
      setLoading(null);
      return;
    }
    try {
      const result = await postJson<VideoResponse>("/video/assemble", {
        ...payload,
        bgm_style: bgmStyle,
        bgm_enabled: bgmEnabled,
        bgm_path: bgmPath ?? undefined,
      });
      setVideoResult(result);
      setVideoText(stringifyPretty(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(null);
    }
  }

  async function handlePipeline() {
    setLoading("pipeline");
    setError(null);
    try {
      const result = await postJson<{ jobId: string }>(
        "/orchestrator/run",
        {
          topic,
          sourceUrl: sourceUrl || undefined,
          sceneCount,
          voice: selectedVoice || undefined,
          bgmStyle,
          bgmEnabled,
          bgmPath: bgmPath ?? undefined,
        },
        { "x-user-id": "demo-user" }
      );
      setJobId(result.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleRetry() {
    if (!jobId) return;
    setLoading("pipeline");
    setError(null);
    try {
      const partial = {
        script: scriptResult ?? undefined,
        audio: audioResult ?? undefined,
        visual: visualResult ?? undefined,
      };
      const result = await postJson<{ jobId: string }>(
        `/orchestrator/retry/${jobId}`,
        {
          topic,
          sourceUrl: sourceUrl || undefined,
          sceneCount,
          failedStage: jobStatus?.failedStage ?? "script",
          partial,
          voice: selectedVoice || undefined,
          bgmStyle,
          bgmEnabled,
          bgmPath: bgmPath ?? undefined,
        },
        { "x-user-id": "demo-user" }
      );
      setJobId(result.jobId);
      setJobStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重试失败");
    } finally {
      setLoading(null);
    }
  }

  async function handleVoicePreview() {
    try {
      const result = await postJson<{ audio_url?: string }>("/voice/preview", {
        voice: selectedVoice || undefined,
        text: voiceSampleText || undefined,
      });
      setVoicePreviewUrl(result.audio_url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "试听失败");
    }
  }

  async function handlePreviewBgm() {
    if (!bgmEnabled) return;
    try {
      const result = await postJson<{ bgm_url?: string }>("/music/generate", {
        style: bgmStyle,
      });
      setBgmPreviewUrl(result.bgm_url ?? null);
      setBgmPath(null);
      setBgmAiStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取背景音乐失败");
    }
  }

  async function handleGenerateAIMusic() {
    if (!bgmAiPrompt.trim()) {
      setError("请填写背景音乐提示词");
      return;
    }
    setBgmAiStatus("生成中...");
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
      setBgmAiStatus("已生成");
      setBgmPreviewUrl(result.bgm_url ?? null);
      setBgmPath(result.bgm_path ?? null);
      setBgmEnabled(true);
    } catch (err) {
      setBgmAiStatus("生成失败");
      setError(err instanceof Error ? err.message : "生成失败");
    }
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <div className="bg-grid">
        <header className="mx-auto max-w-6xl px-4 pb-8 pt-8 md:pt-12">
          <div className="card p-6 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="chip bg-lime-500/20 text-ink-900">Faceless SaaS</span>
                <h1 className="mt-4 text-2xl font-semibold md:text-4xl">
                  全自动无露脸视频生成平台
                </h1>
                <p className="mt-3 text-sm text-ink-500 md:text-base">
                  从脚本、配音、画面到成片，一套工作台完成全部流程。支持单步调试和一键生成。
                </p>
              </div>
              <div className="flex flex-col gap-3 text-sm">
                <div className="rounded-xl border border-ink-900/10 bg-white/70 px-4 py-3">
                  <p className="text-xs text-ink-500">API Base</p>
                  <p className="mt-1 font-semibold">{API_BASE}</p>
                </div>
                <button className="btn-primary" onClick={handlePipeline} disabled={loading === "pipeline"}>
                  {loading === "pipeline" ? "正在执行..." : "一键生成"}
                </button>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label className="text-sm">
                主题
                <input className="input mt-2" value={topic} onChange={(e) => setTopic(e.target.value)} />
              </label>
              <label className="text-sm">
                参考链接（可选）
                <input className="input mt-2" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              </label>
              <label className="text-sm">
                分镜数量
                <input
                  className="input mt-2"
                  type="number"
                  min={3}
                  max={12}
                  value={sceneCount}
                  onChange={(e) => setSceneCount(Number(e.target.value))}
                />
              </label>
              <label className="text-sm">
                人声选择
                <select
                  className="input mt-2"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                >
                  {voices.length === 0 && <option value="">暂无</option>}
                  {voices.map((voice) => (
                    <option key={voice} value={voice}>
                      {voice}
                    </option>
                  ))}
                </select>
                <div className="mt-2">
                  <input
                    className="input"
                    value={voiceSampleText}
                    onChange={(e) => setVoiceSampleText(e.target.value)}
                    placeholder="试听文本"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button className="btn-ghost" type="button" onClick={handleVoicePreview}>
                      试听人声
                    </button>
                    {voicePreviewUrl && (
                      <audio className="w-full" controls src={voicePreviewUrl} />
                    )}
                  </div>
                </div>
              </label>
              <label className="text-sm">
                背景音乐风格
                <select
                  className="input mt-2"
                  value={bgmStyle}
                  onChange={(e) => setBgmStyle(e.target.value)}
                  disabled={!bgmEnabled}
                >
                  {bgmStyles.length === 0 && <option value="default">默认</option>}
                  {bgmStyles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={handlePreviewBgm}
                    disabled={!bgmEnabled}
                  >
                    试听背景音乐
                  </button>
                  {bgmPreviewUrl && (
                    <audio className="w-full" controls src={bgmPreviewUrl} />
                  )}
                </div>
                <div className="mt-3 rounded-lg border border-ink-900/10 bg-white/70 p-3">
                  <p className="text-xs text-ink-500">AI 背景音乐</p>
                  <input
                    className="input mt-2"
                    value={bgmAiPrompt}
                    onChange={(e) => setBgmAiPrompt(e.target.value)}
                    placeholder="输入音乐描述，比如：史诗、科技、轻快"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button className="btn-ghost" type="button" onClick={handleGenerateAIMusic}>
                      生成 AI 背景音乐
                    </button>
                    {bgmAiStatus && <span className="text-xs text-ink-500">{bgmAiStatus}</span>}
                  </div>
                  {bgmPath && (
                    <div className="mt-2 text-xs text-ink-500">
                      已选择 AI 音乐作为背景
                    </div>
                  )}
                </div>
              </label>
              <label className="text-sm">
                关闭背景音乐
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!bgmEnabled}
                    onChange={(e) => setBgmEnabled(!e.target.checked)}
                  />
                  <span className="text-xs text-ink-500">勾选即无背景音乐</span>
                </div>
              </label>
            </div>
            {error && (
              <div className="mt-4 rounded-lg border border-coral-400/30 bg-coral-400/10 px-4 py-3 text-sm text-ink-900">
                {error}
              </div>
            )}
            {jobStatus && (
              <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>进度：{jobStatus.message}</span>
                  <span className="font-semibold">{jobStatus.progress}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${jobStatus.progress}%` }}
                  />
                </div>
                {jobStatus.stage === "failed" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn-primary"
                      onClick={handleRetry}
                      disabled={loading === "pipeline"}
                    >
                      {loading === "pipeline" ? "重试中..." : "从失败步骤重试"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Step 1</p>
                <h2 className="text-lg font-semibold">脚本与分镜</h2>
              </div>
              <button className="btn-primary" onClick={handleScript} disabled={loading === "script"}>
                {loading === "script" ? "生成中..." : "生成脚本"}
              </button>
            </div>
            <textarea
              className="textarea mt-4 h-48 font-mono text-xs"
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="脚本输出将在这里显示"
            />
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Step 2</p>
                <h2 className="text-lg font-semibold">配音与时间戳</h2>
              </div>
              <button className="btn-primary" onClick={handleAudio} disabled={loading === "audio"}>
                {loading === "audio" ? "生成中..." : "生成配音"}
              </button>
            </div>
            <textarea
              className="textarea mt-4 h-48 font-mono text-xs"
              value={audioText}
              onChange={(e) => setAudioText(e.target.value)}
              placeholder="粘贴 Step1 的 scenes 数组"
            />
            {audioResult && (
              <div className="mt-3 text-xs text-ink-500">
                已生成 {audioResult.scenes.length} 段配音
              </div>
            )}
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Step 3</p>
                <h2 className="text-lg font-semibold">视觉素材生成</h2>
              </div>
              <button className="btn-primary" onClick={handleVisual} disabled={loading === "visual"}>
                {loading === "visual" ? "生成中..." : "生成画面"}
              </button>
            </div>
            <textarea
              className="textarea mt-4 h-48 font-mono text-xs"
              value={visualText}
              onChange={(e) => setVisualText(e.target.value)}
              placeholder="粘贴 Step1 的 scenes 数组"
            />
            {visualResult && (
              <div className="mt-3 text-xs text-ink-500">
                已生成 {visualResult.scenes.length} 张图片
              </div>
            )}
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-500">Step 4</p>
                <h2 className="text-lg font-semibold">视频合成</h2>
              </div>
              <button className="btn-primary" onClick={handleVideo} disabled={loading === "video"}>
                {loading === "video" ? "合成中..." : "生成视频"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn-ghost"
                onClick={() => mergedVideoInput && setVideoText(stringifyPretty(mergedVideoInput))}
                disabled={!mergedVideoInput}
              >
                从前序结果生成输入
              </button>
            </div>
            <textarea
              className="textarea mt-4 h-48 font-mono text-xs"
              value={videoText}
              onChange={(e) => setVideoText(e.target.value)}
              placeholder="合成输入 JSON 会显示在这里"
            />
            {videoResult && (
              <div className="mt-3 text-xs text-ink-500">
                <div>输出视频路径：{videoResult.video_path}</div>
                {videoResult.video_url && (
                  <div className="mt-2">
                    <video
                      className="w-full rounded-lg border border-ink-900/10"
                      controls
                      src={videoResult.video_url}
                    />
                  </div>
                )}
                {videoResult.subtitles_burned === false && (
                  <div className="mt-2 text-coral-500">
                    字幕未能烧录到视频中，请检查 ffmpeg 的字幕支持。
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-ink-900/10 bg-white/70 p-6 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">One Click</p>
              <h3 className="text-lg font-semibold">全流程自动生成</h3>
              <p className="text-sm text-ink-500">
                直接使用同一套输入跑完所有模块，并在上方实时查看进度。
              </p>
            </div>
            <button className="btn-primary" onClick={handlePipeline} disabled={loading === "pipeline"}>
              {loading === "pipeline" ? "执行中..." : "启动流水线"}
            </button>
          </div>
          {jobStatus?.result && (
            <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-ink-900 p-4 text-xs text-white">
              {stringifyPretty(jobStatus.result)}
            </pre>
          )}
        </section>
      </main>
    </div>
  );
}
