export type JobStage =
  | "queued"
  | "script"
  | "audio"
  | "visual"
  | "video"
  | "completed"
  | "failed";

export type JobState = {
  id: string;
  userId: string;
  topic?: string;
  sourceUrl?: string;
  sceneCount?: number;
  voice?: string;
  bgmStyle?: string;
  bgmEnabled?: boolean;
  bgmPath?: string;
  stage: JobStage;
  progress: number;
  message: string;
  result?: unknown;
  error?: string;
  failedStage?: "script" | "audio" | "visual" | "video";
};

const jobs = new Map<string, JobState>();

export function createJob(
  id: string,
  input: {
    userId: string;
    topic?: string;
    sourceUrl?: string;
    sceneCount?: number;
    voice?: string;
    bgmStyle?: string;
    bgmEnabled?: boolean;
  }
): JobState {
  const state: JobState = {
    id,
    userId: input.userId,
    topic: input.topic,
    sourceUrl: input.sourceUrl,
    sceneCount: input.sceneCount,
    voice: input.voice,
    bgmStyle: input.bgmStyle,
    bgmEnabled: input.bgmEnabled,
    bgmPath: input.bgmPath,
    stage: "queued",
    progress: 0,
    message: "等待开始",
  };
  jobs.set(id, state);
  return state;
}

export function updateJob(id: string, patch: Partial<JobState>): JobState | null {
  const current = jobs.get(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  jobs.set(id, next);
  return next;
}

export function getJob(id: string): JobState | null {
  return jobs.get(id) ?? null;
}
