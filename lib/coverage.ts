/**
 * 目标词/语法的出现验证
 *
 * LLM 经常漏用要求的词，或者只在标题里带一次。以前的实现是「停留 3 秒就给所有词加分」，
 * 等于把"要求出现"当成"已经出现"。这里做真实匹配，只有验证过的才推进掌握度。
 *
 * findHighlights 同时被文章渲染的高亮复用，保证「看到高亮」和「算作出现」是同一套判定。
 */

import { Article, ArticleCoverage, WordItem, GRAMMAR_OPTIONS } from "./types";

export interface HighlightMatch {
  text: string;
  type: "phrase" | "word";
  start: number;
  end: number;
  /** 命中的目标词（小写），短语命中时是它所属的词 */
  wordKey: string;
}

function isWordBoundary(char: string): boolean {
  return !/[a-zA-Z]/.test(char);
}

const VOWELS = "aeiou";

/**
 * 生成一个词的屈折变化形式。
 *
 * 模型写文章时一定会用 "preserved"、"cats"、"studying" 这些形式，
 * 只按原形精确匹配会把它们误判为「未复现」，既冤枉了模型，也让本该
 * 计入学习记录的词卡在复习队列里。
 *
 * 只覆盖屈折（同一个词的不同形态），不做派生（friend→friendly 是另一个词），
 * 避免误伤。
 */
export function wordVariants(word: string): string[] {
  const w = word.trim().toLowerCase();

  // 词组（check in / after all）和非纯字母的词不做变形
  if (!/^[a-z]+$/.test(w) || w.length < 3) return [w];

  const forms = new Set<string>([w]);
  const last = w[w.length - 1];
  const secondLast = w[w.length - 2];

  // 复数 / 第三人称单数
  if (/(s|x|z|ch|sh|o)$/.test(w)) {
    forms.add(w + "es");
  } else {
    forms.add(w + "s");
  }

  if (last === "y" && !VOWELS.includes(secondLast)) {
    // study → studies / studied / studying
    const stem = w.slice(0, -1);
    forms.add(stem + "ies");
    forms.add(stem + "ied");
    forms.add(w + "ing");
  } else if (last === "e") {
    // preserve → preserved / preserving
    forms.add(w + "d");
    forms.add(w.slice(0, -1) + "ing");
    forms.add(w + "s");
  } else {
    forms.add(w + "ed");
    forms.add(w + "ing");
  }

  // 重读闭音节双写末尾辅音：stop → stopped / stopping
  if (
    w.length >= 3 &&
    !VOWELS.includes(last) &&
    last !== "y" &&
    last !== "w" &&
    VOWELS.includes(secondLast) &&
    !VOWELS.includes(w[w.length - 3])
  ) {
    forms.add(w + last + "ed");
    forms.add(w + last + "ing");
  }

  return [...forms];
}

/**
 * 在文本中找出所有目标词与其搭配短语的位置。
 * 短语优先于单词；重叠区间保留短语。
 */
export function findHighlights(text: string, words: WordItem[]): HighlightMatch[] {
  const matches: HighlightMatch[] = [];
  const lowerText = text.toLowerCase();

  // 1. 先匹配短语（优先级高）
  for (const wordItem of words) {
    const wordKey = wordItem.word.toLowerCase();
    if (!wordItem.phrases) continue;
    for (const phrase of wordItem.phrases) {
      const lowerPhrase = phrase.toLowerCase();
      if (!lowerPhrase) continue;
      let idx = lowerText.indexOf(lowerPhrase);
      while (idx !== -1) {
        matches.push({
          text: text.slice(idx, idx + phrase.length),
          type: "phrase",
          start: idx,
          end: idx + phrase.length,
          wordKey,
        });
        idx = lowerText.indexOf(lowerPhrase, idx + 1);
      }
    }
  }

  // 2. 再匹配单词及其屈折形式（整词匹配，避免 cat 命中 category）
  for (const wordItem of words) {
    const wordKey = wordItem.word.trim().toLowerCase();
    if (!wordKey) continue;

    // 长的形式先匹配，否则 "preserve" 会先吃掉 "preserved" 的前半截
    const variants = wordVariants(wordItem.word).sort(
      (a, b) => b.length - a.length
    );

    for (const variant of variants) {
      let idx = lowerText.indexOf(variant);
      while (idx !== -1) {
        const prevChar = idx > 0 ? text[idx - 1] : "";
        const nextChar =
          idx + variant.length < text.length ? text[idx + variant.length] : "";

        if (isWordBoundary(prevChar) && isWordBoundary(nextChar)) {
          const overlapping = matches.some(
            (m) => idx < m.end && idx + variant.length > m.start
          );
          if (!overlapping) {
            matches.push({
              text: text.slice(idx, idx + variant.length),
              type: "word",
              start: idx,
              end: idx + variant.length,
              wordKey,
            });
          }
        }
        idx = lowerText.indexOf(variant, idx + 1);
      }
    }
  }

  // 3. 排序并合并重叠（短语胜出）
  matches.sort((a, b) => a.start - b.start);
  const merged: HighlightMatch[] = [];
  for (const match of matches) {
    const last = merged[merged.length - 1];
    if (last && match.start < last.end) {
      if (match.type === "phrase" && last.type === "word") {
        merged[merged.length - 1] = match;
      }
    } else {
      merged.push(match);
    }
  }

  return merged;
}

/**
 * 统计每个目标词在正文中出现了几次。
 *
 * 注意只统计正文，不含标题——只在标题里出现一次不算真正的语境复现。
 */
export function countWordOccurrences(
  content: string,
  words: WordItem[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const w of words) {
    counts[w.word.toLowerCase()] = 0;
  }
  for (const match of findHighlights(content, words)) {
    counts[match.wordKey] = (counts[match.wordKey] ?? 0) + 1;
  }
  return counts;
}

/**
 * 各语法点的**必要**标志词。
 *
 * 模型有时会因为「这是要求的语法」就给每个句子都打上标签——实测见过它给
 * "Last summer, I went to Xi'an." 标上定语从句，而它自己的讲解里写着
 * 「本句没有定语从句」。这些错例会污染语法讲解页的用例列表。
 *
 * 这里只列**没有它就一定不成立**的标志（必要非充分条件），
 * 缺失即判定标注有误。没列进来的语法点不做校验，避免误伤。
 */
const GRAMMAR_MARKERS: Record<string, RegExp> = {
  "relative-clauses": /\b(who|whom|whose|which|that|where|when)\b/i,
  "noun-clauses": /\b(that|what|whether|if|who|how|why|where|when)\b/i,
  "there-be": /\bthere\s+(is|are|was|were|has been|have been)\b/i,
  "passive-voice": /\b(am|is|are|was|were|be|been|being|get|got)\b/i,
  "present-perfect": /\b(have|has|'ve|'s)\b/i,
  "past-perfect": /\bhad\b/i,
  "present-continuous": /\b(am|is|are|'m|'re|'s)\b/i,
  "past-continuous": /\b(was|were)\b/i,
  "simple-future": /\b(will|'ll|shall|going to)\b/i,
  "future-in-the-past": /\b(would|should|was going to|were going to)\b/i,
  "conditional-1": /\b(if|unless)\b/i,
  "conditional-2": /\b(if|were|would)\b/i,
  "conditional-3": /\b(if|had|would have)\b/i,
  "subjunctive-mood": /\b(wish|were|should|if only|as if|as though)\b/i,
  "cleft-sentences": /\bit\s+(is|was)\b/i,
  "adverbial-clauses-time": /\b(when|while|before|after|until|till|as soon as|since|as)\b/i,
  "adverbial-clauses-condition": /\b(if|unless|as long as|provided|in case)\b/i,
  "adverbial-clauses-reason": /\b(because|since|as|for)\b/i,
  "adverbial-clauses-concession": /\b(although|though|even though|even if|while|despite)\b/i,
  "adverbial-clauses-result": /\b(so|such)\b/i,
  "adverbial-clauses-purpose": /\b(so that|in order (that|to)|to)\b/i,
  "direct-indirect-speech": /["'“”‘’]|\b(said|told|asked|replied)\b/i,
  "comparative-superlative": /\b(more|most|less|least|than|as)\b|\w+(er|est)\b/i,
  "infinitive": /\bto\s+[a-z]+/i,
  "gerund": /\w+ing\b/i,
  "participles": /\w+(ing|ed|en)\b/i,
  "inversion": /\b(never|seldom|rarely|hardly|not only|no sooner|little|only)\b/i,
  "exclamatory": /[!]|\b(what|how)\b/i,
  "imperative": /^[A-Z][a-z]*|\b(don't|do not|please|let's)\b/,
};

/**
 * 判断一个语法标注是否可信。
 * 除标志词外，还拦截模型自己在讲解里否认的情况（「本句没有定语从句」）。
 */
export function isPlausibleGrammarTag(
  grammarId: string,
  sentence: string,
  explanation?: string
): boolean {
  if (explanation && /没有|不含|不包含|未(使用|出现)|不是/.test(explanation)) {
    const option = GRAMMAR_OPTIONS.find((g) => g.id === grammarId);
    // 讲解里出现「没有 + 该语法名」时，认定这是模型自己否认的错标
    if (option && new RegExp(`(没有|不含|不包含|未使用|未出现)[^，。]*${option.name}`).test(explanation)) {
      return false;
    }
  }

  const marker = GRAMMAR_MARKERS[grammarId];
  return marker ? marker.test(sentence) : true;
}

/** 按名称回退匹配语法 id（老数据的 sentences[].grammars 没有 grammarId） */
export function resolveGrammarId(
  name: string,
  candidates: { id: string; name: string }[] = GRAMMAR_OPTIONS
): string | undefined {
  const trimmed = name.trim();
  const exact = candidates.find((g) => g.name === trimmed);
  if (exact) return exact.id;
  // 「定语从句（关系代词）」这类带补充说明的写法
  return candidates.find(
    (g) => trimmed.includes(g.name) || g.name.includes(trimmed)
  )?.id;
}

/**
 * 统计每个目标语法在句子解析里被标注了几次。
 * 优先用模型返回的 grammarId，缺失时按中文名回退匹配。
 */
export function countGrammarOccurrences(article: Article): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const g of article.grammar) {
    counts[g.id] = 0;
  }

  for (const sentence of article.sentences ?? []) {
    for (const g of sentence.grammars ?? []) {
      const id = g.grammarId ?? resolveGrammarId(g.name, article.grammar);
      if (!id || !(id in counts)) continue;
      // 模型会给不相干的句子乱打标签，这里过滤掉明显站不住脚的标注
      if (!isPlausibleGrammarTag(id, sentence.sentence, g.explanation)) continue;
      counts[id] += 1;
    }
  }
  return counts;
}

/** 反查某个语法在本篇中对应的原句 */
export function sentencesUsingGrammar(
  article: Article,
  grammarId: string
): string[] {
  const result: string[] = [];
  for (const sentence of article.sentences ?? []) {
    const hit = (sentence.grammars ?? []).some((g) => {
      const id = g.grammarId ?? resolveGrammarId(g.name, article.grammar);
      return (
        id === grammarId &&
        isPlausibleGrammarTag(id, sentence.sentence, g.explanation)
      );
    });
    if (hit) result.push(sentence.sentence);
  }
  return result;
}

/**
 * 是否算长难句。
 *
 * 长难句是考研阅读最大的失分点——认识每个词但读不懂整句。
 * 判定用「够长」或「不太长但从句套从句」两个条件，
 * 标出来让用户知道哪几句值得停下来拆一拆。
 */
const CLAUSE_MARKERS =
  /\b(who|whom|whose|which|that|where|when|while|although|though|because|since|unless|whereas|if|as)\b/gi;

export function isLongSentence(sentence: string): boolean {
  const words = sentence.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 28) return true;

  const clauses = sentence.match(CLAUSE_MARKERS)?.length ?? 0;
  const commas = (sentence.match(/,/g) ?? []).length;

  // 中等长度但结构复杂的也算
  return words >= 18 && (clauses >= 2 || (clauses >= 1 && commas >= 2));
}

/** 本篇中的长难句 */
export function longSentencesIn(article: Article): string[] {
  const sentences = article.sentences?.length
    ? article.sentences.map((s) => s.sentence)
    : article.content.split(/(?<=[.!?])\s+/);
  return sentences.filter(isLongSentence);
}

/** 反查某个词在本篇中出现的原句 */
export function sentencesUsingWord(article: Article, word: string): string[] {
  const target = word.toLowerCase();
  const wordItem = article.words.find((w) => w.word.toLowerCase() === target) ?? {
    word,
  };

  const sentences = article.sentences?.length
    ? article.sentences.map((s) => s.sentence)
    : article.content.split(/(?<=[.!?])\s+/);

  return sentences.filter((s) => findHighlights(s, [wordItem]).length > 0);
}

/**
 * 计算一篇文章的完整覆盖情况。生成后立即调用并落盘到 article.coverage。
 */
export function computeCoverage(
  article: Article,
  now: number = Date.now()
): ArticleCoverage {
  const words = countWordOccurrences(article.content, article.words);
  const grammars = countGrammarOccurrences(article);

  return {
    words,
    grammars,
    missingWords: Object.entries(words)
      .filter(([, count]) => count === 0)
      .map(([word]) => word),
    missingGrammars: Object.entries(grammars)
      .filter(([, count]) => count === 0)
      .map(([id]) => id),
    computedAt: now,
  };
}

/** 覆盖率百分比，给学习报告用 */
export function coverageRate(coverage: ArticleCoverage): {
  words: number;
  grammars: number;
} {
  const wordTotal = Object.keys(coverage.words).length;
  const grammarTotal = Object.keys(coverage.grammars).length;
  return {
    words: wordTotal
      ? Math.round(((wordTotal - coverage.missingWords.length) / wordTotal) * 100)
      : 100,
    grammars: grammarTotal
      ? Math.round(
          ((grammarTotal - coverage.missingGrammars.length) / grammarTotal) * 100
        )
      : 100,
  };
}
