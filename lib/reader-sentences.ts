import type { Article, SentenceAnalysis } from "./types";

/** Keep every sentence selectable, even when AI analysis is missing or incomplete. */
export function readableSentences(article: Article): SentenceAnalysis[] {
  const normalized = (text: string) => text.replace(/\s+/g, " ").trim();
  const analyses = new Map((article.sentences ?? []).map((item) => [normalized(item.sentence), item]));
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("en", { granularity: "sentence" }) : null;
  return article.content.split(/\n\s*\n/).flatMap((paragraph) =>
    (segmenter ? [...segmenter.segment(paragraph)].map((item) => item.segment) : paragraph.match(/[^.!?]+(?:[.!?]+["”']?|$)/g) ?? [paragraph]).map((segment) => {
      const sentence = segment.trim();
      return { ...analyses.get(normalized(sentence)), sentence };
    }).filter((item) => item.sentence)
  );
}
