/**
 * 学习反馈闭环。
 *
 * 旧实现：打开文章停留 3 秒 → 所有目标词 +20 掌握度，不管这个词有没有真的
 * 出现在正文里。模型漏用一半的词，用户照样被记成「学过了」。
 *
 * 现在掌握度只在三个明确时机推进：
 *   1. 入册 —— coverage 验证这个词/语法真的出现在用户读的文章里
 *   2. 手动标记 —— 用户在词卡上点掌握度
 *   3. 测验判定 —— 答对推进、答错回退并进入错题队列
 */

import { Article, QuizQuestion, QuizResult } from "./types";
import {
  computeCoverage,
  sentencesUsingGrammar,
  findHighlights,
} from "./coverage";
import { recordWordExposure, gradeWordByText } from "./wordbook";
import { recordGrammarEncounter, gradeGrammar } from "./grammarbook";
import { getProfile, recordArticleRead } from "./recommend";
import { updateArticle } from "./storage";
import { recordArticleReadForGoal } from "./daily-goal";
import { localDateKey } from "./calendar";

/**
 * wordUsages 的 key 大小写不受控（模型有时返回原形有时返回句中形式），
 * 统一转小写便于查找。
 */
export function normalizeWordUsages(
  usages: Record<string, string> | undefined
): Record<string, string> {
  if (!usages) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(usages)) {
    if (typeof value === "string" && value.trim()) {
      result[key.trim().toLowerCase()] = value.trim();
    }
  }
  return result;
}

export interface RegisterResult {
  wordsRegistered: string[];
  wordsMissing: string[];
  grammarsRegistered: string[];
  grammarsMissing: string[];
}

/**
 * 用户读了一篇文章。
 *
 * 只有经 coverage 验证真的出现的目标词/语法才入册并计曝光；
 * 没出现的既不入册也不推进，学习报告里会标为「本篇未复现」。
 */
export function registerArticleLearning(
  article: Article,
  now: number = Date.now()
): RegisterResult {
  const coverage = article.coverage ?? computeCoverage(article, now);
  if (getProfile().history.some((record) => record.articleId === article.id)) {
    return {
      wordsRegistered: Object.keys(coverage.words).filter((key) => coverage.words[key] > 0),
      wordsMissing: coverage.missingWords,
      grammarsRegistered: Object.keys(coverage.grammars).filter((key) => coverage.grammars[key] > 0),
      grammarsMissing: coverage.missingGrammars,
    };
  }

  // 老文章可能没算过 coverage，补算一次并回写
  if (!article.coverage) {
    updateArticle({ ...article, coverage });
  }

  // 模型返回的 wordUsages 形如「文化遗产；搭配：cultural heritage」，
  // 是单词本释义最可靠的来源——它描述的正是这个词在本篇里实际用的义项。
  const usages = normalizeWordUsages(article.wordUsages);

  const wordsRegistered: string[] = [];
  for (const wordItem of article.words) {
    const key = wordItem.word.toLowerCase();
    if ((coverage.words[key] ?? 0) === 0) continue;

    recordWordExposure(
      wordItem.word,
      article.id,
      {
        meaning: wordItem.targetMeaning || wordItem.meaning || usages[key],
        phrases: wordItem.phrases,
        source: article.source ? "unit" : "article",
        unitId: article.source?.unitId,
      },
      now
    );
    wordsRegistered.push(key);
  }

  const grammarsRegistered: string[] = [];
  for (const grammar of article.grammar) {
    if ((coverage.grammars[grammar.id] ?? 0) === 0) continue;
    recordGrammarEncounter(
      grammar.id,
      article.id,
      sentencesUsingGrammar(article, grammar.id),
      now
    );
    grammarsRegistered.push(grammar.id);
  }

  recordArticleRead(
    article.id,
    article.words,
    article.grammar,
    article.difficulty.gradeId, 0, 0, now
  );
  recordArticleReadForGoal(article.id, now);

  return {
    wordsRegistered,
    wordsMissing: coverage.missingWords,
    grammarsRegistered,
    grammarsMissing: coverage.missingGrammars,
  };
}

/**
 * 一道题涉及哪些目标词。
 *
 * 用和正文高亮同一套整词匹配，避免子串误伤——否则目标词 "cat" 会被
 * 选项里的 "category" 命中，答错就白白惩罚了一个无关的词。
 */
function wordsInQuestion(article: Article, question: QuizQuestion): string[] {
  const haystack = `${question.question} ${question.options.join(" ")}`;
  const hits = findHighlights(haystack, article.words);
  return [...new Set(hits.map((h) => h.wordKey))];
}

/**
 * 一道语法题考的是哪个语法点。
 *
 * 题干和解析里通常会点名（"现在完成时" / "Present Perfect"）。
 * 认不出来就宁可不判——错误地把一个用户其实掌握的语法打回「陌生」，
 * 比少记一次成绩伤害更大。文章只有一个语法点时无需推断。
 */
function grammarsInQuestion(
  article: Article,
  question: QuizQuestion
): string[] {
  if (article.grammar.length === 1) return [article.grammar[0].id];

  const haystack =
    `${question.question} ${question.options.join(" ")} ${question.explanation}`.toLowerCase();

  return article.grammar
    .filter(
      (g) =>
        haystack.includes(g.name.toLowerCase()) ||
        haystack.includes(g.nameEn.toLowerCase())
    )
    .map((g) => g.id);
}

/**
 * 测验交卷，按每道题的对错推进相关词/语法的 SRS。
 *
 * 答对 → good（间隔拉长）；答错 → again（当天重来，并被 lesson-plan 排到队首）。
 */
export function applyQuizOutcome(
  article: Article,
  answers: number[],
  result: QuizResult,
  now: number = Date.now()
): void {
  const gradeKey = "lexistory_quiz_grades";
  let gradedDays: Record<string, string> = {};
  try { gradedDays = JSON.parse(localStorage.getItem(gradeKey) || "{}"); } catch { /* Older clients do not have this record. */ }
  const day = localDateKey(now);
  if (gradedDays[article.id] === day) return;
  const quiz = article.quiz ?? [];
  const wrongIds = new Set(result.wrongQuestions);

  // 一个词可能出现在多道题里：只要错过一次就按错处理
  const verdicts = new Map<string, boolean>();
  const grammarVerdicts = new Map<string, boolean>();

  quiz.forEach((question, idx) => {
    if (answers[idx] === undefined) return;
    const correct = !wrongIds.has(question.id);

    for (const word of wordsInQuestion(article, question)) {
      const key = word.toLowerCase();
      verdicts.set(key, (verdicts.get(key) ?? true) && correct);
    }

    if (question.type === "grammar-fill") {
      for (const grammarId of grammarsInQuestion(article, question)) {
        grammarVerdicts.set(
          grammarId,
          (grammarVerdicts.get(grammarId) ?? true) && correct
        );
      }
    }
  });

  for (const [word, correct] of verdicts) {
    gradeWordByText(word, correct ? "good" : "again", now);
  }
  for (const [grammarId, correct] of grammarVerdicts) {
    gradeGrammar(grammarId, correct ? "good" : "again", now);
  }
  gradedDays[article.id] = day;
  localStorage.setItem(gradeKey, JSON.stringify(gradedDays));
}
