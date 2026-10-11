/**
 * 下一篇文章的预生成。
 *
 * 生成一篇要 30-40 秒。日常习惯类产品的操作应该是亚秒级的，每天打开都要
 * 干等半分钟，这个摩擦足以杀死习惯。
 *
 * 解法：用户在读当前这篇时，后台把下一篇算好存起来。回到首页时文章已经在那儿了。
 * 配方是确定性的，完全可以提前算。
 */

import { Article, UserProgress } from "./types";
import { saveArticle } from "./storage";
import { notifyDataChanged } from "./client-store";
import { resolveGrade } from "./grade-resolver";
import type { LessonPlan } from "./lesson-plan";

const PREFETCH_KEY = "lexistory_prefetched";

export interface PrefetchedLesson {
  article: Article;
  /** 生成时用的教材进度，进度变了就作废 */
  progress: { bookId: string; gradeId: string; unitId: string } | null;
  /** 配方摘要，直接展示给用户，不用重新 build */
  summary: string;
  notes: string[];
  /** 词 -> 新学/复现，用于首页配方面板 */
  wordRoles: Record<string, "new" | "review">;
  grammarNames: { name: string; role: "new" | "review" }[];
  createdAt: number;
}

/** 预生成结果的有效期。太旧的话到期词早就变了，不如重算。 */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function getPrefetched(): PrefetchedLesson | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PREFETCH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PrefetchedLesson;
    if (!parsed?.article?.content) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePrefetched(lesson: PrefetchedLesson): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFETCH_KEY, JSON.stringify(lesson));
  } catch {
    // 配额不够就算了，预生成只是加速，不能因此报错
  }
}

export function clearPrefetched(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PREFETCH_KEY);
}

/**
 * 预生成的结果是否还能用。
 *
 * 用户切了单元、或者过了太久（到期词已经变了）就作废，
 * 宁可重新生成也不要给一篇不对路的文章。
 */
export function isPrefetchValid(
  lesson: PrefetchedLesson | null,
  progress: UserProgress | null,
  now: number = Date.now()
): lesson is PrefetchedLesson {
  if (!lesson) return false;
  if (now - lesson.createdAt > MAX_AGE_MS) return false;

  const a = lesson.progress;
  if (!a && !progress) return true;
  if (!a || !progress) return false;

  return (
    a.bookId === progress.bookId &&
    a.gradeId === progress.gradeId &&
    a.unitId === progress.unitId
  );
}

/**
 * 把预生成的文章正式落盘。
 * 只有用户真的点了「开始阅读」才写进历史，否则不会污染记录。
 */
export function commitPrefetched(lesson: PrefetchedLesson): Article {
  saveArticle(lesson.article);
  clearPrefetched();
  notifyDataChanged();
  return lesson.article;
}

/**
 * 把预生成结果还原成配方视图，供首页的配方面板展示。
 * 直接用生成时那份配方，不要重新 build——重算出来的和已生成的文章会对不上。
 */
export function prefetchAsPlan(lesson: PrefetchedLesson): LessonPlan {
  const { article } = lesson;

  return {
    mode: "unit",
    words: article.words.map((item) => ({
      item,
      role: lesson.wordRoles[item.word.toLowerCase()] ?? "new",
      reason: undefined,
    })),
    grammars: article.grammar.map((item) => ({
      item,
      role: article.grammarRoles?.[item.id] ?? "new",
      reason: undefined,
    })),
    grade: resolveGrade(article.difficulty.gradeId),
    theme: article.theme ?? "none",
    style: article.style ?? "natural",
    source: article.source,
    summary: lesson.summary || article.planSummary || "",
    backlog: 0,
    notes: lesson.notes ?? [],
  };
}
