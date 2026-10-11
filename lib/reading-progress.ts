import { getArticles } from "./storage";
import { getProfile } from "./recommend";

const KEY = "lexistory_reading_progress";
export interface ReadingProgress {
  updatedAt: number;
  sentenceIndex?: number;
  completedAt?: number;
}

function readAll(): Record<string, ReadingProgress> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function getReadingProgress(id: string): ReadingProgress | undefined {
  const saved = readAll()[id];
  const legacy = getProfile().history.find((item) => item.articleId === id);
  return saved ? { ...saved, completedAt: saved.completedAt ?? legacy?.readAt } : legacy ? { updatedAt: legacy.readAt, completedAt: legacy.readAt } : undefined;
}

export function saveReadingProgress(id: string, patch: Partial<ReadingProgress>) {
  const entries = readAll();
  entries[id] = { ...getReadingProgress(id), ...patch, updatedAt: Date.now() };
  const existing = new Set(getArticles().map((article) => article.id));
  for (const key of Object.keys(entries)) if (!existing.has(key)) delete entries[key];
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function getContinueReading() {
  return getArticles()
    .map((article) => ({ article, progress: getReadingProgress(article.id) }))
    .filter((item) => item.progress && !item.progress.completedAt)
    .sort((a, b) => b.progress!.updatedAt - a.progress!.updatedAt)[0] ?? null;
}
