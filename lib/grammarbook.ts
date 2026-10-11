import { GrammarBookEntry, GrammarEncounter, GRAMMAR_OPTIONS, GrammarOption } from "./types";
import {
  SrsState,
  ReviewGrade,
  createSrsState,
  reviewSrs,
  isDue,
  recordExposure,
  sortByUrgency,
} from "./srs";
import { notifyDataChanged } from "./client-store";

const GRAMMARBOOK_KEY = "lexistory_grammarbook";

export function getGrammarBook(): GrammarBookEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(GRAMMARBOOK_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as GrammarBookEntry[];
    return Array.isArray(parsed) ? parsed.map(normalizeEntry) : [];
  } catch {
    return [];
  }
}

export function saveGrammarBook(entries: GrammarBookEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GRAMMARBOOK_KEY, JSON.stringify(entries));
  notifyDataChanged();
}

function normalizeEntry(entry: GrammarBookEntry): GrammarBookEntry {
  return {
    ...entry,
    srs: entry.srs ?? createSrsState(entry.addedAt ?? Date.now()),
    encounteredIn: Array.isArray(entry.encounteredIn) ? entry.encounteredIn : [],
  };
}

export function getEntry(grammarId: string): GrammarBookEntry | undefined {
  return getGrammarBook().find((e) => e.grammarId === grammarId);
}

/** 把语法点加入语法本。已存在则原样返回，不重置进度。 */
export function addGrammar(
  grammarId: string,
  now: number = Date.now()
): GrammarBookEntry {
  const book = getGrammarBook();
  const existing = book.find((e) => e.grammarId === grammarId);
  if (existing) return existing;

  const entry: GrammarBookEntry = {
    grammarId,
    srs: createSrsState(now),
    addedAt: now,
    encounteredIn: [],
  };
  book.push(entry);
  saveGrammarBook(book);
  return entry;
}

export function removeGrammar(grammarId: string): void {
  saveGrammarBook(getGrammarBook().filter((e) => e.grammarId !== grammarId));
}

/**
 * 记录「这个语法在某篇文章的这些句子里真的出现了」。
 * 只累计曝光，不改变复习排期——排期由用户的明确反馈驱动。
 */
export function recordGrammarEncounter(
  grammarId: string,
  articleId: string,
  sentences: string[],
  now: number = Date.now()
): void {
  const book = getGrammarBook();
  let entry = book.find((e) => e.grammarId === grammarId);

  if (!entry) {
    entry = {
      grammarId,
      srs: createSrsState(now),
      addedAt: now,
      encounteredIn: [],
    };
    book.push(entry);
  }

  const existing = entry.encounteredIn.find((e) => e.articleId === articleId);
  if (existing) {
    // 同一篇文章重复记录时合并句子，不重复计曝光
    const merged = new Set([...existing.sentences, ...sentences]);
    existing.sentences = [...merged];
  } else {
    entry.encounteredIn.push({ articleId, sentences });
    entry.srs = recordExposure(entry.srs, now);
  }

  saveGrammarBook(book);
}

/** 用户对某个语法作出复习反馈，推进 SRS */
export function gradeGrammar(
  grammarId: string,
  grade: ReviewGrade,
  now: number = Date.now()
): void {
  const book = getGrammarBook();
  const entry = book.find((e) => e.grammarId === grammarId);
  if (!entry) return;
  entry.srs = reviewSrs(entry.srs, grade, now);
  saveGrammarBook(book);
}

/** 按熟练度标记（0-3），内部映射为复习评级 */
export function setGrammarProficiency(
  grammarId: string,
  proficiency: number,
  now: number = Date.now()
): void {
  const grades: ReviewGrade[] = ["again", "hard", "good", "easy"];
  const idx = Math.max(0, Math.min(3, Math.round(proficiency)));
  gradeGrammar(grammarId, grades[idx], now);
}

// ====== 查询 ======

export function getDueGrammars(
  limit?: number,
  now: number = Date.now()
): GrammarBookEntry[] {
  const due = getGrammarBook().filter((e) => isDue(e.srs, now));
  const sorted = sortByUrgency(due, (e) => e.srs, now);
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export function getDueGrammarCount(now: number = Date.now()): number {
  return getGrammarBook().filter((e) => isDue(e.srs, now)).length;
}

export function hasLearned(grammarId: string): boolean {
  return getGrammarBook().some((e) => e.grammarId === grammarId);
}

/** 语法本里已有的 id 集合，用于 lesson-plan 区分「新语法 / 复习语法」 */
export function getLearnedGrammarIds(): Set<string> {
  return new Set(getGrammarBook().map((e) => e.grammarId));
}

export function getGrammarOption(grammarId: string): GrammarOption | undefined {
  return GRAMMAR_OPTIONS.find((g) => g.id === grammarId);
}

/** 语法本条目 + 其静态定义，给列表页用 */
export interface GrammarBookView {
  entry: GrammarBookEntry;
  option: GrammarOption;
  encounterCount: number;
  sentenceCount: number;
}

export function getGrammarBookView(): GrammarBookView[] {
  return getGrammarBook()
    .map((entry) => {
      const option = getGrammarOption(entry.grammarId);
      if (!option) return null;
      return {
        entry,
        option,
        encounterCount: entry.encounteredIn.length,
        sentenceCount: entry.encounteredIn.reduce(
          (sum, e) => sum + e.sentences.length,
          0
        ),
      };
    })
    .filter((v): v is GrammarBookView => v !== null);
}

/** 反查：这个语法出现在哪些文章的哪些句子里 */
export function getEncountersFor(grammarId: string): GrammarEncounter[] {
  return getEntry(grammarId)?.encounteredIn ?? [];
}

export function clearGrammarBook(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GRAMMARBOOK_KEY);
}

export type { SrsState };
