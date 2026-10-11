import { WordBookEntry, WordSource } from "./types";
import {
  ReviewGrade,
  PROFICIENCY_TO_GRADE,
  createSrsState,
  reviewSrs,
  isDue,
  recordExposure,
  seedSrsFromProficiency,
  sortByUrgency,
} from "./srs";
import { notifyDataChanged } from "./client-store";

const WORDBOOK_KEY = "lexistory_wordbook";

/**
 * 兜底补齐 srs 字段。
 * 正常情况下 lib/migrate.ts 已经补过，这里防的是迁移前就被读到的边缘情况。
 */
function normalizeEntry(entry: WordBookEntry): WordBookEntry {
  if (entry.srs) {
    return {
      ...entry,
      proficiency: entry.srs.proficiency,
      seenIn: entry.seenIn ?? [],
    };
  }
  return {
    ...entry,
    srs: seedSrsFromProficiency(
      entry.proficiency ?? 0,
      entry.lastReviewedAt ?? entry.addedAt ?? Date.now(),
      { reviewCount: entry.reviewCount ?? 0 }
    ),
    seenIn: entry.seenIn ?? [],
  };
}

export function getWordBook(): WordBookEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(WORDBOOK_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WordBookEntry[];
    return Array.isArray(parsed) ? parsed.map(normalizeEntry) : [];
  } catch {
    return [];
  }
}

export function saveWordBook(entries: WordBookEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORDBOOK_KEY, JSON.stringify(entries));
  notifyDataChanged();
}

export interface AddWordInput {
  word: string;
  meaning?: string;
  phrases?: string[];
  source?: WordSource;
  unitId?: string;
  /** 到期时间，迁移和批量导入时用来错峰 */
  dueAt?: number;
}

export function addWord(entry: AddWordInput, now: number = Date.now()): WordBookEntry {
  const book = getWordBook();
  const normalizedWord = entry.word.trim().toLowerCase();

  // 去重：如果单词已存在，合并短语和释义
  const existing = book.find((e) => e.word.toLowerCase() === normalizedWord);
  if (existing) {
    let changed = false;
    const newPhrases = entry.phrases?.filter(
      (p) => !existing.phrases?.includes(p)
    );
    if (newPhrases && newPhrases.length > 0) {
      existing.phrases = [...(existing.phrases || []), ...newPhrases];
      changed = true;
    }
    if (!existing.meaning && entry.meaning) {
      existing.meaning = entry.meaning.trim();
      changed = true;
    }
    if (!existing.unitId && entry.unitId) {
      existing.unitId = entry.unitId;
      changed = true;
    }
    if (changed) saveWordBook(book);
    return existing;
  }

  const srs = createSrsState(now);
  if (entry.dueAt !== undefined) srs.dueAt = entry.dueAt;

  const newEntry: WordBookEntry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    word: entry.word.trim(),
    meaning: entry.meaning?.trim(),
    phrases: entry.phrases?.map((p) => p.trim()).filter(Boolean),
    proficiency: 0,
    addedAt: now,
    lastReviewedAt: null,
    reviewCount: 0,
    srs,
    source: entry.source ?? "manual",
    unitId: entry.unitId,
    seenIn: [],
  };

  book.unshift(newEntry);
  saveWordBook(book);
  return newEntry;
}

export function addWords(words: AddWordInput[]): WordBookEntry[] {
  return words.map((w) => addWord(w));
}

export function removeWord(id: string): void {
  saveWordBook(getWordBook().filter((e) => e.id !== id));
}

export function findWord(word: string): WordBookEntry | undefined {
  const target = word.trim().toLowerCase();
  return getWordBook().find((e) => e.word.toLowerCase() === target);
}

// ====== 复习推进 ======

/**
 * 用户在词卡上标记掌握度（0-3），推进 SRS。
 * 这是 SRS 前进的主要入口之一——另一个是测验判定。
 */
export function updateWordProficiency(
  id: string,
  proficiency: number,
  now: number = Date.now()
): void {
  const idx = Math.max(0, Math.min(3, Math.round(proficiency)));
  gradeWord(id, PROFICIENCY_TO_GRADE[idx], now);
}

export function gradeWord(
  id: string,
  grade: ReviewGrade,
  now: number = Date.now()
): void {
  const book = getWordBook();
  const entry = book.find((e) => e.id === id);
  if (!entry) return;

  entry.srs = reviewSrs(entry.srs ?? createSrsState(now), grade, now);
  entry.proficiency = entry.srs.proficiency;
  entry.lastReviewedAt = now;
  entry.reviewCount += 1;
  saveWordBook(book);
}

export function gradeWordByText(
  word: string,
  grade: ReviewGrade,
  now: number = Date.now()
): void {
  const entry = findWord(word);
  if (entry) gradeWord(entry.id, grade, now);
}

/**
 * 记录「这个词在某篇文章里真的出现了」。
 * 词不在本子里就顺手建档——这正是「读到了才算学到」的入册时机。
 */
export function recordWordExposure(
  word: string,
  articleId: string,
  meta: { meaning?: string; phrases?: string[]; source?: WordSource; unitId?: string } = {},
  now: number = Date.now()
): void {
  const normalized = word.trim().toLowerCase();
  const book = getWordBook();
  let entry = book.find((e) => e.word.toLowerCase() === normalized);

  if (!entry) {
    addWord({ word, ...meta, source: meta.source ?? "article" }, now);
    const refreshed = getWordBook();
    entry = refreshed.find((e) => e.word.toLowerCase() === normalized);
    if (!entry) return;
    entry.srs = recordExposure(entry.srs ?? createSrsState(now), now);
    entry.seenIn = [articleId];
    saveWordBook(refreshed);
    return;
  }

  let changed = false;

  // 补全释义：文章生成时模型会返回 wordUsages（中文义项 + 实际用到的搭配），
  // 这是单词本释义的主要来源，没有它单词本里就只剩一串光秃秃的英文。
  if (meta.meaning && !entry.meaning) {
    entry.meaning = meta.meaning.trim();
    changed = true;
  }
  if (meta.phrases?.length) {
    const existing = new Set(entry.phrases ?? []);
    const added = meta.phrases.filter((p) => p && !existing.has(p));
    if (added.length > 0) {
      entry.phrases = [...(entry.phrases ?? []), ...added];
      changed = true;
    }
  }
  if (!entry.unitId && meta.unitId) {
    entry.unitId = meta.unitId;
    changed = true;
  }

  const seenIn = entry.seenIn ?? [];
  if (!seenIn.includes(articleId)) {
    entry.seenIn = [...seenIn, articleId];
    entry.srs = recordExposure(entry.srs ?? createSrsState(now), now);
    changed = true;
  }

  if (changed) saveWordBook(book);
}

// ====== 编辑 ======

export function updateWordMeaning(id: string, meaning: string): void {
  const book = getWordBook();
  const entry = book.find((e) => e.id === id);
  if (!entry) return;
  entry.meaning = meaning.trim();
  saveWordBook(book);
}

export function updateWordPhrases(id: string, phrases: string[]): void {
  const book = getWordBook();
  const entry = book.find((e) => e.id === id);
  if (!entry) return;
  entry.phrases = phrases.map((p) => p.trim()).filter(Boolean);
  saveWordBook(book);
}

// ====== 查询 ======

/** 真正到期的词，按紧迫度排序 */
export function getDueWords(
  limit?: number,
  now: number = Date.now()
): WordBookEntry[] {
  const due = getWordBook().filter((e) => e.srs && isDue(e.srs, now));
  const sorted = sortByUrgency(due, (e) => e.srs!, now);
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export function getDueWordCount(now: number = Date.now()): number {
  return getWordBook().filter((e) => e.srs && isDue(e.srs, now)).length;
}

/** 未来 N 天内每天到期的数量，给单词本的复习预览用 */
export function getUpcomingDueCounts(
  days: number = 7,
  now: number = Date.now()
): { date: string; count: number }[] {
  const book = getWordBook();
  const result: { date: string; count: number }[] = [];
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const dayStart = startToday.getTime() + i * 86400000;
    const dayEnd = dayStart + 86400000;
    const count = book.filter((e) => {
      if (!e.srs) return false;
      // 第 0 天把所有逾期的也算进来
      if (i === 0) return e.srs.dueAt < dayEnd;
      return e.srs.dueAt >= dayStart && e.srs.dueAt < dayEnd;
    }).length;
    result.push({ date: new Date(dayStart).toISOString().slice(0, 10), count });
  }
  return result;
}

export function clearWordBook(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WORDBOOK_KEY);
}
