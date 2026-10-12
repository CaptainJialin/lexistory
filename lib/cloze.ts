/**
 * 语境填空：主动回忆练习。
 *
 * 现在掌握度只能靠用户自己点四个按钮，或者做文章后那三道题——没有真正的提取练习。
 * 而"读懂了"和"想得起来"是两种能力，只读永远练不出后者。
 *
 * 这里把闲置的资产用起来：单词本每个词都存了 seenIn（出现过它的文章 id），
 * 配合 sentencesUsingWord() 能反查出真实原句。于是可以做到——
 * 不是脱离语境的闪卡，而是「你上周在那篇文章里见过它」。
 *
 * 全部素材都在本地，零 API 成本。
 */

import { Article, WordBookEntry } from "./types";
import { getArticles } from "./storage";
import { getWordBook, getDueWords } from "./wordbook";
import { sentencesUsingWord, wordVariants } from "./coverage";
import { isDue, urgency } from "./srs";

export interface ClozeQuestion {
  /** 单词本条目 id，判分后回写 SRS 用 */
  entryId: string;
  /** 要填的词（原形） */
  answer: string;
  /** 句中实际出现的形式，可能是屈折形式 */
  surface: string;
  /** 挖空后的句子，空位用 BLANK 标记 */
  prompt: string;
  /** 该词的中文释义，作为提示 */
  meaning?: string;
  /** 句子出自哪篇文章 */
  articleId: string;
  articleTitle: string;
  /** 该句的中文翻译，答完后展示 */
  translation?: string;
}

export const BLANK = "____";

/** 首字母提示：太难时给一点线索，但不至于白送 */
export function firstLetterHint(word: string): string {
  if (!word) return "";
  return `${word[0]}${"·".repeat(Math.max(1, word.length - 1))}`;
}

/**
 * 在句子里把某个词挖掉。
 *
 * 必须匹配屈折形式——文章里写的是 "preserved"，而单词本里存的是 "preserve"。
 * 只按原形找会一个都挖不到。
 */
function blankOut(
  sentence: string,
  word: string
): { prompt: string; surface: string } | null {
  // 长的形式优先，否则 preserve 会先吃掉 preserved 的前半截
  const variants = wordVariants(word).sort((a, b) => b.length - a.length);
  const lower = sentence.toLowerCase();

  for (const variant of variants) {
    let idx = lower.indexOf(variant);
    while (idx !== -1) {
      const prev = idx > 0 ? sentence[idx - 1] : "";
      const next =
        idx + variant.length < sentence.length
          ? sentence[idx + variant.length]
          : "";
      const isWhole = !/[a-zA-Z]/.test(prev) && !/[a-zA-Z]/.test(next);

      if (isWhole) {
        return {
          prompt:
            sentence.slice(0, idx) + BLANK + sentence.slice(idx + variant.length),
          surface: sentence.slice(idx, idx + variant.length),
        };
      }
      idx = lower.indexOf(variant, idx + 1);
    }
  }
  return null;
}

/** 句子太短没有语境价值，太长又读不完 */
function isUsableSentence(sentence: string): boolean {
  const words = sentence.trim().split(/\s+/).filter(Boolean).length;
  return words >= 6 && words <= 45;
}

/**
 * 给一个单词本条目找一道题。
 * 优先用最近读过的文章——刚读过的语境记忆最鲜活。
 */
function buildQuestionFor(
  entry: WordBookEntry,
  articlesById: Map<string, Article>
): ClozeQuestion | null {
  const seen = entry.seenIn ?? [];
  if (seen.length === 0) return null;

  const candidates = seen
    .map((id) => articlesById.get(id))
    .filter((a): a is Article => !!a)
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const article of candidates) {
    for (const sentence of sentencesUsingWord(article, entry.word)) {
      if (!isUsableSentence(sentence)) continue;
      const blanked = blankOut(sentence, entry.word);
      if (!blanked) continue;

      const analysis = article.sentences?.find((s) => s.sentence === sentence);

      return {
        entryId: entry.id,
        answer: entry.word,
        surface: blanked.surface,
        prompt: blanked.prompt,
        meaning: entry.meaning,
        articleId: article.id,
        articleTitle: article.title,
        translation: analysis?.translation,
      };
    }
  }

  return null;
}

export interface BuildClozeOptions {
  limit?: number;
  now?: number;
  /** 只出到期的词；false 时到期的不够会用其他未掌握的词补 */
  dueOnly?: boolean;
}

/**
 * 组一套复习题。
 *
 * 只能出用户**真正读到过**的词——没有语境就没有这个练习存在的意义。
 */
export function buildClozeSet(opts: BuildClozeOptions = {}): ClozeQuestion[] {
  const { limit = 10, now = Date.now(), dueOnly = false } = opts;

  const articlesById = new Map(getArticles().map((a) => [a.id, a]));
  if (articlesById.size === 0) return [];

  const due = getDueWords(undefined, now).filter(
    (e) => (e.seenIn?.length ?? 0) > 0
  );

  const pool: WordBookEntry[] = [...due];

  if (!dueOnly && pool.length < limit) {
    // 到期的不够时，用还没掌握、但读到过的词补齐
    const dueIds = new Set(due.map((e) => e.id));
    const extra = getWordBook()
      .filter(
        (e) =>
          !dueIds.has(e.id) &&
          (e.seenIn?.length ?? 0) > 0 &&
          (e.srs?.proficiency ?? e.proficiency) < 3
      )
      .sort((a, b) => urgency(b.srs!, now) - urgency(a.srs!, now));
    pool.push(...extra);
  }

  const questions: ClozeQuestion[] = [];
  for (const entry of pool) {
    if (questions.length >= limit) break;
    const question = buildQuestionFor(entry, articlesById);
    if (question) questions.push(question);
  }

  return questions;
}

/** 现在有多少词可以做语境填空 */
export function countClozeAvailable(now: number = Date.now()): {
  due: number;
  total: number;
} {
  const articles = new Map(getArticles().map((article) => [article.id, article]));
  const book = getWordBook().filter((entry) => buildQuestionFor(entry, articles) !== null);
  return {
    due: book.filter((e) => e.srs && isDue(e.srs, now)).length,
    total: book.filter((e) => (e.srs?.proficiency ?? e.proficiency) < 3 || (e.srs && isDue(e.srs, now))).length,
  };
}

export type ClozeVerdict = "correct" | "close" | "wrong";

export interface ClozeCheck {
  verdict: ClozeVerdict;
  /** 正确答案在句中的形式 */
  expected: string;
  /** close 时给出的说明 */
  note?: string;
}

/**
 * 判分。
 *
 * 分三档而不是对错两分：写出原形但句中是屈折形式（preserve vs preserved）
 * 说明词是记住了，只是形态没到位——判成"差一点"并给出提示，
 * 比直接判错更符合实际掌握程度。
 */
export function checkCloze(
  question: ClozeQuestion,
  input: string
): ClozeCheck {
  const answer = input.trim().toLowerCase();
  const surface = question.surface.toLowerCase();
  const base = question.answer.toLowerCase();

  if (!answer) return { verdict: "wrong", expected: question.surface };

  if (answer === surface) {
    return { verdict: "correct", expected: question.surface };
  }

  // 词对了但形态不对
  if (answer === base || wordVariants(question.answer).includes(answer)) {
    return {
      verdict: "close",
      expected: question.surface,
      note: `词对了，这里要用 ${question.surface}`,
    };
  }

  return { verdict: "wrong", expected: question.surface };
}
