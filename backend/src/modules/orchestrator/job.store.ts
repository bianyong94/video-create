import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import path from "path";

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
  narrationDensity?: "short" | "medium" | "long";
  targetDurationMinutes?: number;
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
  createdAt?: string;
  updatedAt?: string;
};

const jobs = new Map<string, JobState>();

function getJobsDir(): string {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
  const jobsDir = path.join(baseDir, "jobs");
  mkdirSync(jobsDir, { recursive: true });
  return jobsDir;
}

function getJobFilePath(id: string): string {
  return path.join(getJobsDir(), `${id}.json`);
}

function persistJob(state: JobState): void {
  const filePath = getJobFilePath(state.id);
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf-8");
  renameSync(tempPath, filePath);
}

function loadJob(id: string): JobState | null {
  const filePath = getJobFilePath(id);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as JobState;
    jobs.set(id, parsed);
    return parsed;
  } catch {
    try {
      unlinkSync(filePath);
    } catch {}
    return null;
  }
}

export function createJob(
  id: string,
  input: {
    userId: string;
    topic?: string;
    sourceUrl?: string;
    sceneCount?: number;
    narrationDensity?: "short" | "medium" | "long";
    targetDurationMinutes?: number;
    voice?: string;
    bgmStyle?: string;
    bgmEnabled?: boolean;
    bgmPath?: string;
  }
): JobState {
  const now = new Date().toISOString();
  const state: JobState = {
    id,
    userId: input.userId,
    topic: input.topic,
    sourceUrl: input.sourceUrl,
    sceneCount: input.sceneCount,
    narrationDensity: input.narrationDensity,
    targetDurationMinutes: input.targetDurationMinutes,
    voice: input.voice,
    bgmStyle: input.bgmStyle,
    bgmEnabled: input.bgmEnabled,
    bgmPath: input.bgmPath,
    stage: "queued",
    progress: 0,
    message: "等待开始",
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, state);
  persistJob(state);
  return state;
}

export function updateJob(id: string, patch: Partial<JobState>): JobState | null {
  const current = jobs.get(id) ?? loadJob(id);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  jobs.set(id, next);
  persistJob(next);
  return next;
}

export function getJob(id: string): JobState | null {
  return jobs.get(id) ?? loadJob(id);
}
