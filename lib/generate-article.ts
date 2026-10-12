import type { Article, EducationLevel } from "./types";
import { type LessonPlan, planWords, planGrammars, planWordRoles, planGrammarRoles } from "./lesson-plan";
import { computeCoverage } from "./coverage";
import { saveArticle } from "./storage";
import { apiFetch } from "./api-client";
import { normalizeGeneratedContent } from "./generated-content";

type GenerateOptions = { signal?: AbortSignal; save?: boolean; onStage?: (stage: "writing" | "saving") => void };

/** Save the usable story immediately. Its reader owns resumable sentence analysis. */
export async function generateArticleFromPlan(plan: LessonPlan, opts: GenerateOptions = {}): Promise<Article> {
  const words = planWords(plan);
  const grammars = planGrammars(plan);
  const wordRoles = planWordRoles(plan);
  const grammarRoles = planGrammarRoles(plan);
  if (!words.length) throw new Error("没有可用的单词，请先选择单元或导入词表");
  if (!grammars.length) throw new Error("没有可用的语法点");
  opts.onStage?.("writing");
  const response = await apiFetch("/api/generate", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: opts.signal,
    body: JSON.stringify({ words, grammars, grade: plan.grade, theme: plan.theme, style: plan.style, wordRoles, grammarRoles }),
  });
  const data = await response.json();
  opts.signal?.throwIfAborted();
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "生成失败，请稍后重试。");
  opts.onStage?.("saving");
  const article: Article = {
    ...normalizeGeneratedContent(data),
    id: crypto.randomUUID(), words, grammar: grammars,
    difficulty: { level: plan.grade.level as EducationLevel, gradeId: plan.grade.id },
    sentences: [], analysisStatus: "pending", theme: plan.theme, style: plan.style, source: plan.source,
    wordRoles, grammarRoles, planSummary: plan.summary, createdAt: Date.now(),
  };
  article.coverage = computeCoverage(article);
  if (opts.save !== false) saveArticle(article);
  return article;
}

export async function regenerateArticle(
  source: Article,
  grade: { id: string; name: string; level: string; cefr: string; description: string },
  signal?: AbortSignal
): Promise<Article> {
  const response = await apiFetch("/api/generate", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ words: source.words, grammars: source.grammar, grade, theme: source.theme, style: source.style, wordRoles: source.wordRoles, grammarRoles: source.grammarRoles }),
  });
  const data = await response.json();
  signal?.throwIfAborted();
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "生成失败，请稍后重试。");
  const article: Article = {
    ...source, ...normalizeGeneratedContent(data), isDemo: false,
    id: crypto.randomUUID(), sentences: [], analysisStatus: "pending", coverage: undefined, createdAt: Date.now(),
  };
  article.coverage = computeCoverage(article);
  saveArticle(article);
  return article;
}

export type { LessonRole } from "./types";
