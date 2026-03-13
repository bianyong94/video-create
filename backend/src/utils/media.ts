import path from "path";

export function buildPublicMediaUrl(
  filePath: string,
  baseUrl?: string
): string | null {
  const resolvedBase =
    baseUrl ?? process.env.PUBLIC_BASE_URL ?? "";
  if (!resolvedBase) {
    return null;
  }
  const storageDir =
    process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");
  const rel = path.relative(storageDir, filePath).split(path.sep).join("/");
  return `${resolvedBase}/media/${rel}`;
}
