/**
 * 从学习配方生成一篇文章。
 *
 * 首页生成、复习生成、文章页「重新生成」都走这一条路径，
 * 保证 wordRoles / coverage 这些字段不会有的地方写、有的地方漏。
 */

import { Article, EducationLevel, LessonRole, SentenceAnalysis } from "./types";
import {
  LessonPlan,
  planWords,
  planGrammars,
  planWordRoles,
  planGrammarRoles,
} from "./lesson-plan";
import { computeCoverage } from "./coverage";
import { saveArticle } from "./storage";
import { apiFetch } from "./api-client";

interface GenerateResponse {
  title?: string;
  content?: string;
  translation?: string;
  quiz?: unknown;
  wordUsages?: Record<string, string>;
  error?: string;
}

/**
 * 拉取逐句解析。
 *
 * 单独一次调用——和正文合并生成时输出经常超过模型的 token 上限，
 * 截断后整篇都废掉。这里失败也不抛错：解析只是增强，正文已经能读了，
 * 大不了少一层句子标注。
 */
async function fetchAnalysis(
  content: string,
  grammars: Article["grammar"],
  grade: LessonPlan["grade"],
  signal?: AbortSignal
): Promise<SentenceAnalysis[]> {
  try {
    const res = await apiFetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, grammars, grade }),
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { sentences?: SentenceAnalysis[] };
    return Array.isArray(data.sentences) ? data.sentences : [];
  } catch (error) {
    if (signal?.aborted) throw error;
    return [];
  }
}

export async function generateArticleFromPlan(
  plan: LessonPlan,
  /**
   * save=false 用于后台预生成——文章先不进历史记录，
   * 等用户真的点开阅读时再落盘，否则没读过的文章会污染历史。
   */
  opts: { signal?: AbortSignal; save?: boolean; onStage?: (stage: "writing" | "analysis") => void } = {}
): Promise<Article> {
  const words = planWords(plan);
  const grammars = planGrammars(plan);
  const wordRoles = planWordRoles(plan);
  const grammarRoles = planGrammarRoles(plan);

  if (words.length === 0) {
    throw new Error("没有可用的单词，请先选择单元或导入词表");
  }
  if (grammars.length === 0) {
    throw new Error("没有可用的语法点");
  }

  opts.onStage?.("writing");
  const res = await apiFetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      words,
      grammars,
      grade: plan.grade,
      theme: plan.theme,
      style: plan.style,
      wordRoles,
      grammarRoles,
    }),
    signal: opts.signal,
  });

  const data = (await res.json()) as GenerateResponse;
  if (!res.ok) {
    throw new Error(data.error || "生成失败");
  }

  const content = data.content || "";
  if (!content.trim()) throw new Error("这次没有生成有效正文，请重试。");
  opts.onStage?.("analysis");
  const sentences = await fetchAnalysis(content, grammars, plan.grade, opts.signal);
  opts.signal?.throwIfAborted();

  const article: Article = {
    id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    title: data.title || "无标题",
    content,
    translation: data.translation || "",
    words,
    grammar: grammars,
    difficulty: {
      level: plan.grade.level as EducationLevel,
      gradeId: plan.grade.id,
    },
    sentences,
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
    wordUsages: data.wordUsages || {},
    theme: plan.theme,
    style: plan.style,
    source: plan.source,
    wordRoles,
    grammarRoles,
    planSummary: plan.summary,
    createdAt: Date.now(),
  };

  // 生成后立刻验证目标词/语法是否真的出现，结果随文章一起落盘
  article.coverage = computeCoverage(article);

  if (opts.save !== false) saveArticle(article);
  return article;
}

/**
 * 用同一份配方重新生成（文章页的「重新生成」按钮）。
 * 沿用原文章的词、语法和角色标注，只换一篇正文。
 */
export async function regenerateArticle(
  source: Article,
  grade: { id: string; name: string; level: string; cefr: string; description: string }
): Promise<Article> {
  const res = await apiFetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      words: source.words,
      grammars: source.grammar,
      grade,
      theme: source.theme,
      style: source.style,
      wordRoles: source.wordRoles,
      grammarRoles: source.grammarRoles,
    }),
  });

  const data = (await res.json()) as GenerateResponse;
  if (!res.ok) throw new Error(data.error || "生成失败");

  const content = data.content || "";
  if (!content.trim()) throw new Error("这次没有生成有效正文，请重试。");
  const sentences = await fetchAnalysis(
    content,
    source.grammar,
    grade as LessonPlan["grade"]
  );

  const article: Article = {
    ...source,
    isDemo: false,
    id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    title: data.title || "无标题",
    content,
    translation: data.translation || "",
    sentences,
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
    wordUsages: data.wordUsages || {},
    coverage: undefined,
    createdAt: Date.now(),
  };

  article.coverage = computeCoverage(article);
  saveArticle(article);
  return article;
}

export type { LessonRole };
