/**
 * 学习配方：决定一篇文章由哪些词和语法组成。
 *
 * 这是整个改造的核心。旧实现只把「当前单元的词 + 当前单元的语法」丢给模型，
 * 学过的东西再也不会回来。这里把四个来源混在一起：
 *
 *   1. 教材单元的新词
 *   2. 单词本里到期该复习的词
 *   3. 测验答错涉及的词（优先级最高的复习词）
 *   4. 用户自己粘贴导入的词
 *
 * 语法同理：当前单元的新语法 + 语法本里到期的旧语法。
 */

import {
  Article,
  ArticleTheme,
  ArticleStyle,
  EducationLevel,
  GradeOption,
  GrammarOption,
  LessonRole,
  UserProgress,
  WordBookEntry,
  WordItem,
  WORD_PHRASES,
  GRAMMAR_OPTIONS,
  getGrammarsByIds,
} from "./types";
import {
  getAllBooks,
  getGradesByBook,
  getUnitById,
  getUnitsByGrade,
  getWordsByUnit,
  getGrammarIdsByUnit,
} from "./official-words";
import { getWordBook, getDueWords, getDueWordCount } from "./wordbook";
import { getDueGrammars, getLearnedGrammarIds } from "./grammarbook";
import { getQuizResults, getArticles } from "./storage";
import { resolveGrade } from "./grade-resolver";

/**
 * 一篇文章能承载的目标词数量。
 *
 * 由 lib/prompt.ts 的 lengthGuidelines 反推：目标词约占正文 6%，钳制在 4-18。
 * 这修的是一个既有 bug——初中单元有 21-44 个词，而 j3 的文章只有 200-280 词，
 * 一次性全塞进去等于每 6 个词就有一个生词，远超可理解输入的阈值。
 */
export const WORD_BUDGET: Record<string, number> = {
  p1: 4, p2: 5, p3: 5, p4: 6, p5: 7, p6: 8,
  j1: 10, j2: 11, j3: 12,
  s1: 13, s2: 14, s3: 15,
  c1: 16, c2: 16, c3: 18, c4: 18,
  g1: 16, g2: 17, g3: 18,
};

const DEFAULT_BUDGET = 12;
/** 复习词最多占非自定义槽位的比例 */
const REVIEW_SHARE = 0.45;
const MAX_GRAMMARS = 3;

export function getWordBudget(gradeId: string): number {
  return WORD_BUDGET[gradeId] ?? DEFAULT_BUDGET;
}

// ====== 类型 ======

export interface LessonSlot<T> {
  item: T;
  role: LessonRole;
  /** 为什么选它，展示在配方面板上 */
  reason?: string;
}

export type LessonMode = "unit" | "review" | "custom" | "grammar";

export interface LessonPlan {
  mode: LessonMode;
  words: LessonSlot<WordItem>[];
  grammars: LessonSlot<GrammarOption>[];
  grade: GradeOption;
  theme: ArticleTheme;
  style: ArticleStyle;
  source?: Article["source"];
  /** 「本单元 40 词，这是第 2/4 篇」 */
  unitProgress?: { index: number; total: number; unitWordCount: number };
  /** 一句话配方摘要 */
  summary: string;
  /** 还有多少到期词没排上队 */
  backlog: number;
  /** 降级/边界情况的说明，展示给用户 */
  notes: string[];
}

export interface BuildLessonPlanOptions {
  progress: UserProgress | null;
  mode?: LessonMode;
  /** 用户粘贴导入的词 */
  customWords?: WordItem[];
  /** 从语法讲解页发起时指定的语法 */
  focusGrammarId?: string;
  /** 覆盖题材，不传则随机 */
  theme?: ArticleTheme;
  now?: number;
}

// ====== 辅助 ======

const THEMES: ArticleTheme[] = [
  "story", "news", "sci-fi", "daily", "adventure", "social",
  "frontier", "economy", "livelihood", "biography", "travel", "history", "nature",
];

function pickTheme(): ArticleTheme {
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}

export function getDefaultArticleStyle(level: EducationLevel): ArticleStyle {
  if (level === "junior") return "exam-entrance";
  if (level === "senior") return "exam-college";
  if (level === "graduate") return "exam-graduate";
  return "natural";
}

function toWordItem(entry: WordBookEntry): WordItem {
  return {
    word: entry.word,
    meaning: entry.meaning,
    // 复习词沿用上次确定的义项，避免模型换一个意思用，复习就失效了
    targetMeaning: entry.meaning,
    phrases: entry.phrases?.length
      ? entry.phrases
      : WORD_PHRASES[entry.word.toLowerCase()],
  };
}

/**
 * 找出测验答错的题涉及哪些词。
 *
 * QuizResult 只存错题 id，所以要回到文章里把题目文本取出来，
 * 看题干和选项里出现了哪些目标词。这是启发式的，但足够把「刚错过的词」提到队首。
 */
export function getWrongQuizWords(limit: number = 20): Set<string> {
  const results = getQuizResults();
  if (results.length === 0) return new Set();

  const articles = new Map(getArticles().map((a) => [a.id, a]));
  const wrong = new Set<string>();

  // 从最近的测验往回找
  const recent = [...results].sort((a, b) => b.completedAt - a.completedAt);

  for (const result of recent) {
    if (wrong.size >= limit) break;
    if (!result.wrongQuestions?.length) continue;

    const article = articles.get(result.articleId);
    if (!article?.quiz) continue;

    for (const questionId of result.wrongQuestions) {
      const question = article.quiz.find((q) => q.id === questionId);
      if (!question) continue;

      const haystack = `${question.question} ${question.options.join(" ")}`.toLowerCase();
      for (const w of article.words) {
        const key = w.word.toLowerCase();
        if (haystack.includes(key)) wrong.add(key);
      }
    }
  }

  return wrong;
}

/** 单元里用户还没真正读到过的词 */
function getFreshUnitWords(
  bookId: string,
  gradeId: string,
  unitId: string
): { fresh: string[]; total: number } {
  const unitWords = getWordsByUnit(bookId, gradeId, unitId);
  const book = getWordBook();
  const seen = new Map(book.map((e) => [e.word.toLowerCase(), e]));

  const fresh = unitWords.filter((w) => {
    const entry = seen.get(w.toLowerCase());
    // 在本子里但从没在文章中真正出现过的，仍然算新词
    return !entry || (entry.srs?.exposures ?? 0) === 0;
  });

  return { fresh, total: unitWords.length };
}

/**
 * 用单词本里已有的释义和搭配补全一个词。
 * 学过的词带着上次确定的义项进入新文章，模型才不会换一个意思用。
 *
 * 传入预建的索引而不是在函数里查——单词本可能有几百条，
 * 每个词都重新读一次 localStorage 会退化成 O(n²)。
 */
function enrichFromWordBook(
  word: string,
  index: Map<string, WordBookEntry>
): WordItem {
  const entry = index.get(word.toLowerCase());
  return {
    word,
    meaning: entry?.meaning,
    targetMeaning: entry?.meaning,
    phrases: entry?.phrases?.length
      ? entry.phrases
      : WORD_PHRASES[word.toLowerCase()],
  };
}

/**
 * 分配槽位。
 * 自定义词优先占位 → 到期复习词占剩余的 45% → 其余给单元新词 → 不足时互相回填。
 */
export function allocateSlots(opts: {
  budget: number;
  customCount: number;
  dueCount: number;
  freshCount: number;
}): { custom: number; review: number; fresh: number } {
  const { budget, customCount, dueCount, freshCount } = opts;

  const custom = Math.min(customCount, budget);
  const remaining = budget - custom;
  if (remaining <= 0) return { custom, review: 0, fresh: 0 };

  const reviewCap = Math.ceil(remaining * REVIEW_SHARE);
  let review = Math.min(dueCount, reviewCap);
  let fresh = Math.min(freshCount, remaining - review);

  // 单元新词不够 → 多拿复习词补
  if (fresh < remaining - review) {
    review = Math.min(dueCount, remaining - fresh);
  }
  // 复习词不够 → 多拿新词补
  if (review < reviewCap) {
    fresh = Math.min(freshCount, remaining - review);
  }

  return { custom, review, fresh };
}

// ====== 主函数 ======

export function buildLessonPlan(opts: BuildLessonPlanOptions): LessonPlan {
  const now = opts.now ?? Date.now();
  const { progress, customWords = [], focusGrammarId } = opts;
  const notes: string[] = [];

  // ---- 年级与教材上下文 ----
  const unit =
    progress && getUnitById(progress.bookId, progress.gradeId, progress.unitId);
  const gradeId = progress?.gradeId ?? "j2";
  const grade = resolveGrade(gradeId);
  const budget = getWordBudget(grade.id);

  const mode: LessonMode =
    opts.mode ?? (customWords.length > 0 ? "custom" : focusGrammarId ? "grammar" : "unit");

  // ---- 词源 ----
  const wrongWords = getWrongQuizWords();
  const allDue = getDueWords(undefined, now);

  // 错题词排到队首
  const dueSorted = [
    ...allDue.filter((e) => wrongWords.has(e.word.toLowerCase())),
    ...allDue.filter((e) => !wrongWords.has(e.word.toLowerCase())),
  ];

  const { fresh: freshWords, total: unitWordCount } =
    unit && progress
      ? getFreshUnitWords(progress.bookId, progress.gradeId, progress.unitId)
      : { fresh: [], total: 0 };

  // 纯复习模式：整篇只用到期的旧词，不掺新词。
  // 给用户一个主动消化积压的入口——否则到期数只能靠每天那几个新词慢慢带，
  // 用户看着一个自己无法干预的数字只会焦虑。
  const reviewOnly = mode === "review";

  const alloc = reviewOnly
    ? {
        custom: 0,
        review: Math.min(dueSorted.length, budget),
        fresh: 0,
      }
    : allocateSlots({
        budget,
        customCount: customWords.length,
        dueCount: dueSorted.length,
        freshCount: freshWords.length,
      });

  // ---- 组装词槽 ----
  const slots: LessonSlot<WordItem>[] = [];
  const used = new Set<string>();

  const push = (item: WordItem, role: LessonRole, reason?: string) => {
    const key = item.word.trim().toLowerCase();
    if (!key || used.has(key)) return;
    used.add(key);
    slots.push({ item, role, reason });
  };

  for (const w of customWords.slice(0, alloc.custom)) {
    push(w, "new", "你导入的词");
  }

  for (const entry of dueSorted.slice(0, alloc.review)) {
    const isWrong = wrongWords.has(entry.word.toLowerCase());
    push(
      toWordItem(entry),
      "review",
      isWrong ? "上次测验答错" : "到期复习"
    );
  }

  const wordBookIndex = new Map(
    getWordBook().map((e) => [e.word.toLowerCase(), e])
  );
  for (const word of freshWords.slice(0, alloc.fresh)) {
    push(
      enrichFromWordBook(word, wordBookIndex),
      "new",
      unit ? `${unit.unitName} 新词` : "新词"
    );
  }

  // 兜底：一个词都没有时，用单词本里最陈旧的词撑起一篇复习文
  if (slots.length === 0) {
    const fallback = getWordBook()
      .filter((e) => (e.srs?.proficiency ?? e.proficiency) < 3)
      .sort((a, b) => (a.srs?.dueAt ?? 0) - (b.srs?.dueAt ?? 0))
      .slice(0, budget);
    fallback.forEach((e) => push(toWordItem(e), "review", "巩固"));
    if (fallback.length > 0) {
      notes.push("当前单元的词都读过了，本篇用单词本里的词做巩固。");
    }
  }

  // ---- 语法槽 ----
  const grammarSlots = buildGrammarSlots({
    progress,
    focusGrammarId,
    now,
    notes,
  });

  // ---- 单元进度 ----
  // 每篇的新词配额必须是**固定**的，不能用今天实际分到的 alloc.fresh。
  // 否则第一天没有复习词时 fresh=11 算出「分 4 篇」，第二天 fresh=6 又变成
  // 「分 7 篇」，用户会觉得越读越多。
  const freshPerArticle = Math.max(1, budget - Math.ceil(budget * REVIEW_SHARE));
  const consumed = unitWordCount - freshWords.length;
  const unitProgress =
    unit && unitWordCount > 0
      ? {
          index: Math.min(
            Math.ceil(unitWordCount / freshPerArticle),
            Math.floor(consumed / freshPerArticle) + 1
          ),
          total: Math.max(1, Math.ceil(unitWordCount / freshPerArticle)),
          unitWordCount,
        }
      : undefined;

  // ---- 说明文案 ----
  const newCount = slots.filter((s) => s.role === "new").length;
  const reviewCount = slots.filter((s) => s.role === "review").length;
  const backlog = Math.max(0, getDueWordCount(now) - reviewCount);

  if (reviewOnly) {
    notes.push("复习模式：本篇只用学过的词，不引入新词。");
  } else if (reviewCount === 0 && dueSorted.length === 0) {
    notes.push("今天没有需要复现的旧词，本篇全部是新内容。");
  }
  if (backlog > 0) {
    // 措辞刻意不用「排队 / 欠 / 待完成」——这些词是可以复现的素材，不是债务。
    // 一天读一篇本来就只能带 10 来个词，把剩下的说成待办只会制造焦虑。
    notes.push(
      `另有 ${backlog} 个学过的词也适合复现，会在后续文章里陆续安排。`
    );
  }
  if (customWords.length > alloc.custom) {
    notes.push(
      `导入的 ${customWords.length} 个词超出本篇容量，其余已加入单词本，会在后续文章中出现。`
    );
  }
  if (!reviewOnly && unitProgress && unitProgress.total > 1) {
    notes.push(
      `本单元共 ${unitWordCount} 个词，分 ${unitProgress.total} 篇消化，这是第 ${unitProgress.index} 篇。`
    );
  }
  // 单元词读完后如果不提示，用户会一直停在这个单元反复复习，不知道该前进
  if (!reviewOnly && unit && freshWords.length === 0 && progress) {
    const next = findNextUnitAcrossGrades(progress);
    notes.push(
      next
        ? "本单元的词已经全部读到过了，可以进入下一单元。"
        : "本册已学完，接下来以复习巩固为主。"
    );
  }

  const level = grade.level;
  const source =
    unit && progress
      ? {
          bookId: progress.bookId,
          bookName:
            getAllBooks().find((b) => b.id === progress.bookId)?.name ??
            progress.bookId,
          gradeId: progress.gradeId,
          gradeName:
            getGradesByBook(progress.bookId).find(
              (g) => g.gradeId === progress.gradeId
            )?.gradeName ?? progress.gradeId,
          unitId: progress.unitId,
          unitName: unit.unitName,
        }
      : undefined;

  return {
    mode,
    words: slots,
    grammars: grammarSlots,
    grade,
    theme: opts.theme ?? pickTheme(),
    style: getDefaultArticleStyle(level),
    source,
    unitProgress,
    summary: buildSummary(newCount, reviewCount, grammarSlots),
    backlog,
    notes,
  };
}

function buildGrammarSlots(opts: {
  progress: UserProgress | null;
  focusGrammarId?: string;
  now: number;
  notes: string[];
}): LessonSlot<GrammarOption>[] {
  const { progress, focusGrammarId, now, notes } = opts;
  const learned = getLearnedGrammarIds();
  const slots: LessonSlot<GrammarOption>[] = [];
  const used = new Set<string>();

  const push = (item: GrammarOption, role: LessonRole, reason?: string) => {
    if (used.has(item.id) || slots.length >= MAX_GRAMMARS) return;
    used.add(item.id);
    slots.push({ item, role, reason });
  };

  // 从语法讲解页发起时，指定的语法优先
  if (focusGrammarId) {
    const focus = GRAMMAR_OPTIONS.find((g) => g.id === focusGrammarId);
    if (focus) {
      push(
        focus,
        learned.has(focus.id) ? "review" : "new",
        "你选择专项练习"
      );
    }
  }

  // 当前单元的语法：没学过的算新，学过的算复习
  const unitGrammarIds = progress
    ? getGrammarIdsByUnit(progress.bookId, progress.gradeId, progress.unitId)
    : [];
  const unitGrammars = getGrammarsByIds(unitGrammarIds);

  for (const g of unitGrammars) {
    if (!learned.has(g.id)) push(g, "new", "本单元语法");
  }

  // 语法本里到期的旧语法
  for (const entry of getDueGrammars(undefined, now)) {
    if (slots.length >= MAX_GRAMMARS) break;
    const option = GRAMMAR_OPTIONS.find((g) => g.id === entry.grammarId);
    if (option) push(option, "review", "到期复习");
  }

  // 单元语法都学过、也没到期的 → 放回来当复习
  for (const g of unitGrammars) {
    if (slots.length >= MAX_GRAMMARS) break;
    push(g, "review", "本单元语法");
  }

  if (slots.length === 0) {
    const fallback = GRAMMAR_OPTIONS.find((g) => g.id === "simple-present");
    if (fallback) {
      push(fallback, "new", "默认语法");
      notes.push("当前单元没有指定语法，本篇使用一般现在时。");
    }
  }

  return slots;
}

function buildSummary(
  newWords: number,
  reviewWords: number,
  grammars: LessonSlot<GrammarOption>[]
): string {
  const parts: string[] = [];
  if (newWords > 0) parts.push(`${newWords} 个新词`);
  if (reviewWords > 0) parts.push(`${reviewWords} 个复习词`);

  const grammarText = grammars
    .map((g) => `${g.item.name}(${g.role === "new" ? "新" : "复习"})`)
    .join(" + ");

  const wordText = parts.length > 0 ? parts.join(" + ") : "无目标词";
  return grammarText ? `${wordText} · ${grammarText}` : wordText;
}

// ====== 给生成流程用的派生数据 ======

export function planWords(plan: LessonPlan): WordItem[] {
  return plan.words.map((s) => s.item);
}

export function planGrammars(plan: LessonPlan): GrammarOption[] {
  return plan.grammars.map((s) => s.item);
}

export function planWordRoles(plan: LessonPlan): Record<string, LessonRole> {
  return Object.fromEntries(
    plan.words.map((s) => [s.item.word.toLowerCase(), s.role])
  );
}

export function planGrammarRoles(plan: LessonPlan): Record<string, LessonRole> {
  return Object.fromEntries(plan.grammars.map((s) => [s.item.id, s.role]));
}

// ====== 词义补全 ======

export interface EnrichedWord {
  word: string;
  partOfSpeech?: string;
  meanings?: string[];
  targetMeaning?: string;
  phrases?: string[];
  usagePatterns?: string[];
}

/** 配方里还缺释义的词——只有这些需要调接口补全 */
export function wordsNeedingEnrichment(plan: LessonPlan): string[] {
  return plan.words
    .filter((slot) => !slot.item.targetMeaning && !slot.item.meaning)
    .map((slot) => slot.item.word);
}

/**
 * 把补全结果合并进配方。
 * 补全是尽力而为的：拿不到就按原样生成，prompt 里已要求模型自行选定义项。
 */
export function applyEnrichment(
  plan: LessonPlan,
  enriched: EnrichedWord[]
): LessonPlan {
  if (enriched.length === 0) return plan;

  const byWord = new Map(
    enriched
      .filter((e) => typeof e?.word === "string")
      .map((e) => [e.word.trim().toLowerCase(), e])
  );

  return {
    ...plan,
    words: plan.words.map((slot) => {
      const hit = byWord.get(slot.item.word.toLowerCase());
      if (!hit) return slot;
      return {
        ...slot,
        item: {
          ...slot.item,
          meaning: slot.item.meaning ?? hit.targetMeaning,
          targetMeaning: slot.item.targetMeaning ?? hit.targetMeaning,
          meanings: slot.item.meanings ?? hit.meanings,
          partOfSpeech: slot.item.partOfSpeech ?? hit.partOfSpeech,
          usagePatterns: slot.item.usagePatterns ?? hit.usagePatterns,
          phrases: slot.item.phrases?.length ? slot.item.phrases : hit.phrases,
        },
      };
    }),
  };
}

/** 当前年级的单元读完时，找下一个可学单元（跨年级） */
export function findNextUnitAcrossGrades(
  progress: UserProgress
): { gradeId: string; unitId: string } | null {
  const grades = getGradesByBook(progress.bookId);
  const gradeIdx = grades.findIndex((g) => g.gradeId === progress.gradeId);
  if (gradeIdx === -1) return null;

  const units = getUnitsByGrade(progress.bookId, progress.gradeId);
  const unitIdx = units.findIndex((u) => u.unitId === progress.unitId);

  if (unitIdx !== -1 && unitIdx < units.length - 1) {
    return { gradeId: progress.gradeId, unitId: units[unitIdx + 1].unitId };
  }

  // 本年级读完，进入下一年级
  for (let i = gradeIdx + 1; i < grades.length; i++) {
    const nextUnits = getUnitsByGrade(progress.bookId, grades[i].gradeId);
    if (nextUnits.length > 0) {
      return { gradeId: grades[i].gradeId, unitId: nextUnits[0].unitId };
    }
  }

  return null;
}
