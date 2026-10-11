/**
 * 学习档案：连续天数、阅读历史、汇总统计。
 *
 * 掌握度不再存在这里——单词的掌握度归 lib/wordbook.ts，语法归 lib/grammarbook.ts，
 * 两者共用 lib/srs.ts 的调度状态。旧版的 wordMastery / grammarMastery 是只写不读的
 * 死数据，已由 lib/migrate.ts 清除。
 */

import { UserLearningProfile, GrammarOption, WordItem } from "./types";
import { getWordBook, getDueWordCount } from "./wordbook";
import { getGrammarBook, getDueGrammarCount } from "./grammarbook";

const PROFILE_KEY = "lexistory_profile";

// ====== 档案读写 ======
export function getProfile(): UserLearningProfile {
  if (typeof window === "undefined") return createEmptyProfile();
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return createEmptyProfile();
  try {
    const parsed = JSON.parse(raw) as UserLearningProfile;
    return { ...createEmptyProfile(), ...parsed };
  } catch {
    return createEmptyProfile();
  }
}

export function saveProfile(profile: UserLearningProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function createEmptyProfile(): UserLearningProfile {
  return {
    history: [],
    totalArticles: 0,
    streakDays: 0,
    lastStudyDate: "",
  };
}

// ====== 学习行为记录 ======

/**
 * 记录一次阅读。
 *
 * 只记录「读了什么」，不再在这里推进掌握度——掌握度由 coverage 验证和测验结果驱动，
 * 见 lib/learning.ts。
 */
export function recordArticleRead(
  articleId: string,
  words: WordItem[],
  grammars: GrammarOption[],
  gradeId: string,
  sentenceClicks: number = 0,
  timeSpentSeconds: number = 0
): void {
  const profile = getProfile();
  const today = new Date().toISOString().slice(0, 10);

  // 同一篇文章不重复计入历史
  if (profile.history.some((h) => h.articleId === articleId)) return;

  // 更新连续学习天数
  if (profile.lastStudyDate) {
    const last = new Date(profile.lastStudyDate);
    const todayDate = new Date(today);
    const diff = Math.floor(
      (todayDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) {
      profile.streakDays += 1;
    } else if (diff > 1) {
      profile.streakDays = 1;
    }
  } else {
    profile.streakDays = 1;
  }
  profile.lastStudyDate = today;

  profile.history.unshift({
    articleId,
    words: words.map((w) => w.word.toLowerCase()),
    grammarIds: grammars.map((g) => g.id),
    gradeId,
    readAt: Date.now(),
    sentenceClicks,
    timeSpentSeconds,
  });

  // 只保留最近 100 条记录
  if (profile.history.length > 100) {
    profile.history = profile.history.slice(0, 100);
  }

  profile.totalArticles = profile.history.length;
  saveProfile(profile);
}

/** 记录句子点击（反映理解困难度），用于统计页 */
export function recordSentenceClick(articleId: string): void {
  const profile = getProfile();
  const record = profile.history.find((h) => h.articleId === articleId);
  if (!record) return;
  record.sentenceClicks += 1;
  saveProfile(profile);
}

// ====== 统计 ======

export interface LearningStats {
  totalArticles: number;
  streakDays: number;
  /** 单词本里的词数 */
  knownWords: number;
  /** 已掌握（proficiency 3）的词数 */
  masteredWords: number;
  /** 语法本里的语法点数 */
  knownGrammars: number;
  masteredGrammars: number;
  dueWords: number;
  dueGrammars: number;
  lastStudyDate: string;
  avgSentenceClicks: number;
}

export function getLearningStats(): LearningStats {
  const profile = getProfile();
  const wordBook = getWordBook();
  const grammarBook = getGrammarBook();

  return {
    totalArticles: profile.totalArticles,
    streakDays: profile.streakDays,
    knownWords: wordBook.length,
    masteredWords: wordBook.filter((e) => (e.srs?.proficiency ?? e.proficiency) >= 3)
      .length,
    knownGrammars: grammarBook.length,
    masteredGrammars: grammarBook.filter((e) => e.srs.proficiency >= 3).length,
    dueWords: getDueWordCount(),
    dueGrammars: getDueGrammarCount(),
    lastStudyDate: profile.lastStudyDate,
    avgSentenceClicks:
      profile.history.length > 0
        ? Math.round(
            profile.history.reduce((s, h) => s + h.sentenceClicks, 0) /
              profile.history.length
          )
        : 0,
  };
}
