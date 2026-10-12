import { apiFetch } from "./api-client";
import { computeCoverage } from "./coverage";
import { normalizeSentenceAnalysis } from "./generated-content";
import { resolveArticleGrade } from "./grade-resolver";
import { registerAnalyzedGrammar } from "./learning";
import { withLearningTransaction } from "./learning-transaction";
import { readableSentences } from "./reader-sentences";
import { getArticleById, updateArticle } from "./storage";
import type { Article } from "./types";

/** The story is already saved. Only request missing sentences; cancellation leaves it resumable. */
export async function analyzeArticle(article: Article, signal: AbortSignal): Promise<Article> {
  const missing = readableSentences(article).filter((sentence) => !sentence.translation);
  if (!missing.length) return article;
  const response = await apiFetch("/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ content: missing.map((item) => item.sentence).join("\n\n"), grammars: article.grammar, grade: resolveArticleGrade(article) }),
  });
  const data = await response.json();
  signal.throwIfAborted();
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "解析暂未准备好，可以稍后重试。");
  const incoming = normalizeSentenceAnalysis(data?.sentences);
  const current = getArticleById(article.id);
  if (!current || current.content !== article.content) throw new Error("文章已发生变化，本次解析已停止。");
  const normalized = (sentence: string) => sentence.replace(/\s+/g, " ").trim();
  const additions = new Map(incoming.filter((item) => item.translation).map((item) => [normalized(item.sentence), item]));
  let added = 0;
  const sentences = readableSentences(current).map((item) => {
    const addition = additions.get(normalized(item.sentence));
    if (item.translation || !addition) return item;
    added++;
    return { ...addition, sentence: item.sentence };
  });
  if (!added) throw new Error("解析暂未准备好，可以稍后重试。正文和朗读仍可使用。");
  const updated: Article = { ...current, sentences, analysisStatus: sentences.every((item) => item.translation) ? "ready" : "partial" };
  updated.coverage = computeCoverage(updated);
  withLearningTransaction(() => {
    updateArticle(updated);
    // If the user already finished reading, add late grammar without crediting the story twice.
    registerAnalyzedGrammar(updated);
  });
  return updated;
}
