/**
 * 英译汉练习（考研英语一 10 分题型）。
 *
 * 这是最考研的一件事，而且几乎全部复用已有素材——句子、参考译文、
 * 成分拆解、难词释义，生成文章时就都存下来了，之前只是拿来看，没拿来练。
 *
 * 选句优先含到期词的长难句，让翻译练习同时服务于复习。
 */

import { Article, SentenceAnalysis } from "./types";
import { getArticles } from "./storage";
import { getDueWords } from "./wordbook";
import { isLongSentence, findHighlights } from "./coverage";

export interface TranslationTask {
  articleId: string;
  articleTitle: string;
  sentence: string;
  /** 参考译文，提交后才展示 */
  reference?: string;
  analysis?: SentenceAnalysis;
  /** 句中包含的、正在复习的词 */
  dueWords: string[];
}

const TRANSLATION_KEY = "lexistory_translation_records";

export interface TranslationRecord {
  articleId: string;
  sentence: string;
  input: string;
  score: number;
  completedAt: number;
}

/**
 * 组一批可练的长难句。
 *
 * 只挑用户读过的文章——练一句他没见过语境的句子没有意义。
 */
export function buildTranslationTasks(
  limit: number = 5,
  now: number = Date.now()
): TranslationTask[] {
  const articles = getArticles();
  if (articles.length === 0) return [];

  const dueSet = new Set(
    getDueWords(undefined, now).map((e) => e.word.toLowerCase())
  );

  const done = new Set(
    getTranslationRecords().map((r) => r.sentence)
  );

  const candidates: (TranslationTask & { priority: number })[] = [];

  for (const article of articles) {
    for (const analysis of article.sentences ?? []) {
      const sentence = analysis.sentence;
      if (!isLongSentence(sentence)) continue;
      if (done.has(sentence)) continue;      // 练过的不重复出
      if (!analysis.translation) continue;   // 没有参考译文就没法对照

      const hits = findHighlights(sentence, article.words)
        .map((h) => h.wordKey)
        .filter((w) => dueSet.has(w));
      const dueWords = [...new Set(hits)];

      candidates.push({
        articleId: article.id,
        articleTitle: article.title,
        sentence,
        reference: analysis.translation,
        analysis,
        dueWords,
        // 含到期词的优先；其次挑较新的文章
        priority: dueWords.length * 1000 + article.createdAt / 1e10,
      });
    }
  }

  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((c) => ({
      articleId: c.articleId,
      articleTitle: c.articleTitle,
      sentence: c.sentence,
      reference: c.reference,
      analysis: c.analysis,
      dueWords: c.dueWords,
    }));
}

export function countTranslationAvailable(now: number = Date.now()): number {
  return buildTranslationTasks(999, now).length;
}

// ====== 练习记录 ======

export function getTranslationRecords(): TranslationRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(TRANSLATION_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TranslationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTranslationRecord(record: TranslationRecord): void {
  if (typeof window === "undefined") return;
  const records = getTranslationRecords();
  records.unshift(record);
  // 只保留最近 200 条
  localStorage.setItem(
    TRANSLATION_KEY,
    JSON.stringify(records.slice(0, 200))
  );
}

export interface TranslationStats {
  count: number;
  averageScore: number;
  recentScores: number[];
}

export function getTranslationStats(): TranslationStats {
  const records = getTranslationRecords();
  if (records.length === 0) {
    return { count: 0, averageScore: 0, recentScores: [] };
  }
  const recent = records.slice(0, 10);
  return {
    count: records.length,
    averageScore: Math.round(
      records.reduce((sum, r) => sum + r.score, 0) / records.length
    ),
    recentScores: recent.map((r) => r.score).reverse(),
  };
}

/** 判断用户是不是随便糊弄了一下——太短或根本没中文的不该拿分 */
export function looksLikeRealAttempt(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length < 4) return false;
  const chineseChars = (trimmed.match(/[一-龥]/g) ?? []).length;
  return chineseChars >= 3;
}

export type { Article };
