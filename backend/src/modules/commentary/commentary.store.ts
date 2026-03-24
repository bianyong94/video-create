import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import type { CommentaryProject } from "./commentary.types";

const projects = new Map<string, CommentaryProject>();

function getProjectsDir(): string {
  const baseDir = process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
  const projectsDir = path.join(baseDir, "commentary-projects");
  mkdirSync(projectsDir, { recursive: true });
  return projectsDir;
}

function getProjectFilePath(id: string): string {
  return path.join(getProjectsDir(), `${id}.json`);
}

function persistProject(project: CommentaryProject): void {
  const filePath = getProjectFilePath(project.id);
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(project, null, 2), "utf-8");
  renameSync(tempPath, filePath);
}

function loadProject(id: string): CommentaryProject | null {
  const filePath = getProjectFilePath(id);
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as CommentaryProject;
    projects.set(id, parsed);
    return parsed;
  } catch {
    try {
      unlinkSync(filePath);
    } catch {}
    return null;
  }
}

export function createProject(project: CommentaryProject): CommentaryProject {
  projects.set(project.id, project);
  persistProject(project);
  return project;
}

export function updateProject(id: string, patch: Partial<CommentaryProject>): CommentaryProject | null {
  const current = projects.get(id) ?? loadProject(id);
  if (!current) return null;
  const next: CommentaryProject = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  projects.set(id, next);
  persistProject(next);
  return next;
}

export function getProject(id: string): CommentaryProject | null {
  return projects.get(id) ?? loadProject(id);
}
