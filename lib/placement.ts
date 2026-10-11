/**
 * 开屏词汇摸底。
 *
 * 解决的问题：新用户第一天单词本是空的，没有任何到期词，配方全是新词，
 * 界面上写着「今天没有需要复现的旧词」——**产品最独特的那件事，第一天根本看不到**，
 * 要到第三天才浮现。而大部分人第二天就不再打开了。
 *
 * 摸底把这个顺序倒过来：30 秒标完 20 个词，立刻拿到词汇量估算，
 * 并且第一篇文章里就是他刚说不认识的词。第一次打开就完成一次完整的价值证明。
 */

import {
  EducationLevel,
  WordItem,
  WORD_POOL,
  WORD_PHRASES,
  GRADE_OPTIONS,
} from "./types";
import { addWord, updateWordProficiency, findWord } from "./wordbook";
import { getGraduateTiers, getGraduateMeaning } from "./graduate-vocab";
import { getAllBooks, getGradesByBook, getUnitsByGrade } from "./official-words";
import { UserProgress } from "./types";

/** 摸底题量。再多用户就没耐心了，再少估不准。 */
export const PLACEMENT_SIZE = 20;

/**
 * 各学段的累计词汇量参考值，用于把「认识几个」换算成「词汇量约多少」。
 * 取自国内课标与考纲的常见口径，量级对即可，不追求精确。
 */
const TIER_VOCAB_SIZE: Record<EducationLevel, number> = {
  primary: 800,
  junior: 1600,
  senior: 3500,
  college: 6000,
  graduate: 5500,
};

/** 摸底时的难度阶梯：低于、等于、高于目标学段 */
const TIER_ORDER: EducationLevel[] = [
  "primary",
  "junior",
  "senior",
  "college",
  "graduate",
];

export interface PlacementWord {
  word: string;
  tier: EducationLevel;
}

export interface PlacementAnswer {
  word: string;
  tier: EducationLevel;
  known: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 组一套摸底题。
 *
 * 跨三个难度层取样——只考目标层的话，全会或全不会都estimate不出东西，
 * 也无法判断该把起点调高还是调低。
 */
/**
 * 考研摸底单独取样。
 *
 * 通用逻辑会从相邻学段取样，而 graduate 的下一层是 college——
 * WORD_POOL.college 装的是 subaltern / syllogism / postmodernism / hermeneutics
 * 这类人文社科研讨词，考研根本不考。考研学生会全标「不认识」，结果是
 * 词汇量被严重低估，而且这些词还会被塞进单词本、出现在第一篇文章里。
 *
 * 改用考研词表自己的三个难度阶段做梯度。
 */
function buildGraduatePlacementSet(): PlacementWord[] {
  const tiers = getGraduateTiers();
  const plan: [string[], number][] = [
    [tiers.basic, 6],
    [tiers.core, 7],
    [tiers.advanced, 7],
  ];

  const picked: PlacementWord[] = [];
  const used = new Set<string>();

  for (const [pool, count] of plan) {
    let taken = 0;
    for (const word of shuffle(pool)) {
      if (taken >= count) break;
      const key = word.toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      picked.push({ word, tier: "graduate" });
      taken++;
    }
  }

  return shuffle(picked).slice(0, PLACEMENT_SIZE);
}

export function buildPlacementSet(target: EducationLevel): PlacementWord[] {
  if (target === "graduate") return buildGraduatePlacementSet();

  const idx = TIER_ORDER.indexOf(target);
  const below = idx > 0 ? TIER_ORDER[idx - 1] : null;
  const above = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;

  // 目标层占大头，上下各取一部分。
  // 配额必须按实际存在的相邻层来分，否则学段处在两端（小学 / 考研）时
  // 会凑不满题数——之前小学只出 18 题、考研只出 14 题就是这个原因。
  const quota = new Map<EducationLevel, number>();
  const neighbours = [below, above].filter(Boolean) as EducationLevel[];
  const perNeighbour = neighbours.length > 0
    ? Math.floor(PLACEMENT_SIZE * 0.3 / neighbours.length)
    : 0;

  for (const tier of neighbours) quota.set(tier, perNeighbour);
  quota.set(target, PLACEMENT_SIZE - perNeighbour * neighbours.length);

  const picked: PlacementWord[] = [];
  const used = new Set<string>();

  const take = (tier: EducationLevel, count: number) => {
    for (const word of shuffle(WORD_POOL[tier] ?? [])) {
      if (picked.length >= PLACEMENT_SIZE) return;
      if (count <= 0) return;
      const key = word.toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      picked.push({ word, tier });
      count--;
    }
  };

  for (const [tier, count] of quota) take(tier, count);

  // 某一层词池不够时，从其他层补齐到足额
  if (picked.length < PLACEMENT_SIZE) {
    const fallback = [target, ...neighbours, ...TIER_ORDER];
    for (const tier of fallback) {
      if (picked.length >= PLACEMENT_SIZE) break;
      take(tier, PLACEMENT_SIZE - picked.length);
    }
  }

  // 打乱难度顺序，避免用户看出「越往后越难」而改变作答策略
  return shuffle(picked).slice(0, PLACEMENT_SIZE);
}

export interface PlacementResult {
  knownCount: number;
  total: number;
  /** 估算词汇量 */
  estimatedVocabulary: number;
  /** 建议的学段 */
  suggestedLevel: EducationLevel;
  /** 建议的起始年级 id */
  suggestedGradeId: string;
  unknownWords: string[];
  knownWords: string[];
}

/**
 * 按各难度层的正确率加权估算词汇量。
 *
 * 某一层认识 70%，就认为掌握了该层词汇量的 70%，逐层累加。
 * 粗糙但直观，且和用户在别处见过的「词汇量测试」口径一致。
 */
export function estimatePlacement(
  answers: PlacementAnswer[],
  target: EducationLevel
): PlacementResult {
  const byTier = new Map<EducationLevel, { known: number; total: number }>();
  for (const answer of answers) {
    const entry = byTier.get(answer.tier) ?? { known: 0, total: 0 };
    entry.total += 1;
    if (answer.known) entry.known += 1;
    byTier.set(answer.tier, entry);
  }

  let vocabulary = 0;
  for (const tier of TIER_ORDER) {
    const stat = byTier.get(tier);
    if (!stat || stat.total === 0) continue;
    vocabulary += (stat.known / stat.total) * TIER_VOCAB_SIZE[tier];
  }

  // 目标层的正确率决定起点该上调还是下调
  const targetStat = byTier.get(target);
  const targetRatio = targetStat?.total ? targetStat.known / targetStat.total : 0.5;

  const grades = GRADE_OPTIONS.filter((g) => g.level === target);
  let gradeIdx = Math.floor(grades.length / 2);
  if (targetRatio >= 0.8) gradeIdx = grades.length - 1;
  else if (targetRatio <= 0.35) gradeIdx = 0;

  return {
    knownCount: answers.filter((a) => a.known).length,
    total: answers.length,
    estimatedVocabulary: Math.max(100, Math.round(vocabulary / 50) * 50),
    suggestedLevel: target,
    suggestedGradeId: grades[gradeIdx]?.id ?? grades[0]?.id ?? "j2",
    unknownWords: answers.filter((a) => !a.known).map((a) => a.word),
    knownWords: answers.filter((a) => a.known).map((a) => a.word),
  };
}

/**
 * 把摸底结果写进单词本。
 *
 * 认识的词标为「熟悉」并推后排期——它们不该占用复习名额，
 * 但计入词汇量，让用户第一天打开统计页就不是一片空白。
 * 不认识的词设为今日到期，直接进入第一篇文章。
 */
export function seedWordBookFromPlacement(
  result: PlacementResult,
  now: number = Date.now()
): void {
  for (const word of result.knownWords) {
    addWord(
      {
        word,
        // 考研词表自带释义，直接带上，省掉一次补全调用
        meaning: getGraduateMeaning(word),
        phrases: WORD_PHRASES[word.toLowerCase()],
        source: "manual",
      },
      now
    );
    const entry = findWord(word);
    if (entry) updateWordProficiency(entry.id, 2, now); // 熟悉
  }

  for (const word of result.unknownWords) {
    addWord(
      {
        word,
        meaning: getGraduateMeaning(word),
        phrases: WORD_PHRASES[word.toLowerCase()],
        source: "manual",
        dueAt: now,
      },
      now
    );
  }
}

/** 摸底结果 → 教材进度。挑该学段下第一本有内容的教材。 */
export function progressFromPlacement(
  result: PlacementResult
): UserProgress | null {
  // 同一学段有多本时挑内容最全的那本——考研下有「大纲」(4 单元) 和
  // 「核心词」(30 单元) 两本，按顺序取会拿到只有 102 个词的那本。
  const book = getAllBooks()
    .filter((b) => b.level === result.suggestedLevel)
    .sort(
      (a, b) =>
        b.grades.flatMap((g) => g.units).length -
        a.grades.flatMap((g) => g.units).length
    )[0];
  if (!book) return null;

  const grades = getGradesByBook(book.id);
  const grade =
    grades.find((g) => g.gradeId === result.suggestedGradeId) ?? grades[0];
  if (!grade) return null;

  const units = getUnitsByGrade(book.id, grade.gradeId);
  if (units.length === 0) return null;

  return {
    bookId: book.id,
    gradeId: grade.gradeId,
    unitId: units[0].unitId,
    completedUnits: [],
    unitStates: {},
  };
}

/** 不认识的词 → 第一篇文章的目标词 */
export function unknownWordsAsItems(result: PlacementResult): WordItem[] {
  return result.unknownWords.map((word) => {
    const meaning = getGraduateMeaning(word);
    return {
      word,
      meaning,
      // 带上目标义项，模型才会按预期的意思来写
      targetMeaning: meaning,
      phrases: WORD_PHRASES[word.toLowerCase()],
    };
  });
}

/** 该学段词汇量的参考总量，用于在结果页给出「掌握 X / 共 Y」的对照 */
export function getVocabularyTarget(level: EducationLevel): {
  total: number;
  label: string;
} {
  if (level === "graduate") {
    return { total: 5500, label: "考研大纲约 5500 词" };
  }
  return { total: TIER_VOCAB_SIZE[level], label: "" };
}

/** 摸底可选的学段——只列出真正有教材数据的 */
export function getAvailableStages(): {
  level: EducationLevel;
  label: string;
  description: string;
  primary: boolean;
}[] {
  const labels: Record<
    string,
    { label: string; description: string; primary?: boolean }
  > = {
    graduate: {
      label: "考研英语",
      description: "30 个主题单元 · 750 个高频核心词 · 长难句专项",
      primary: true,
    },
    junior: { label: "初中", description: "人教版 Go for it，中考词汇" },
    primary: { label: "小学", description: "人教版 PEP 三年级起点" },
  };

  const levels = new Set(getAllBooks().map((b) => b.level));
  // 考研排在最前：这是当前主打的方向，内容也最完整
  const order: EducationLevel[] = ["graduate", "junior", "primary"];

  return order
    .filter((l) => levels.has(l) && labels[l])
    .map((level) => ({
      level,
      label: labels[level].label,
      description: labels[level].description,
      primary: labels[level].primary ?? false,
    }));
}
