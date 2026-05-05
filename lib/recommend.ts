import { UserLearningProfile, LearningRecord, GrammarOption, GradeOption, WordItem } from "./types";
import { getArticles } from "./storage";
import { GRAMMAR_OPTIONS } from "./types";

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
    wordMastery: {},
    grammarMastery: {},
    history: [],
    totalArticles: 0,
    streakDays: 0,
    lastStudyDate: "",
  };
}

// ====== 学习行为记录 ======
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

  // 更新单词掌握度
  for (const w of words) {
    const key = w.word.toLowerCase();
    const current = profile.wordMastery[key] ?? 0;
    // 首次出现 +20，重复出现 +5，最高100
    profile.wordMastery[key] = Math.min(100, current + (current > 0 ? 5 : 20));
  }

  // 更新语法点掌握度
  for (const g of grammars) {
    const current = profile.grammarMastery[g.id] ?? 0;
    profile.grammarMastery[g.id] = Math.min(100, current + (current > 0 ? 5 : 20));
  }

  // 记录历史
  profile.history.unshift({
    articleId,
    words: words.map((w) => w.word.toLowerCase()),
    grammarIds: grammars.map((g) => g.id),
    gradeId,
    readAt: Date.now(),
    sentenceClicks,
    timeSpentSeconds,
  });

  // 只保留最近50条记录
  if (profile.history.length > 50) {
    profile.history = profile.history.slice(0, 50);
  }

  profile.totalArticles = profile.history.length;
  saveProfile(profile);
}

// 记录句子点击（反映理解困难度）
export function recordSentenceClick(articleId: string): void {
  const profile = getProfile();
  const record = profile.history.find((h) => h.articleId === articleId);
  if (record) {
    record.sentenceClicks += 1;
    // 点击多说明理解困难，降低相关语法掌握度
    for (const gid of record.grammarIds) {
      const current = profile.grammarMastery[gid] ?? 50;
      profile.grammarMastery[gid] = Math.max(0, current - 2);
    }
    saveProfile(profile);
  }
}

// ====== 推荐算法 ======
export interface Recommendation {
  title: string;
  description: string;
  suggestedWords: WordItem[];
  suggestedGrammars: GrammarOption[];
  suggestedGradeId: string;
  reason: string;
  type: "weak_grammar" | "new_words" | "review" | "continue";
}

export function generateRecommendations(gradeId?: string): Recommendation[] {
  const profile = getProfile();
  const recommendations: Recommendation[] = [];

  // 1. 薄弱语法推荐
  const weakGrammars = Object.entries(profile.grammarMastery)
    .filter(([, score]) => score < 60)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([id]) => GRAMMAR_OPTIONS.find((g) => g.id === id))
    .filter(Boolean) as GrammarOption[];

  if (weakGrammars.length > 0) {
    const g = weakGrammars[0];
    recommendations.push({
      title: `强化 ${g.name}`,
      description: `你在 ${g.name} 上的掌握度较低，建议针对性练习。`,
      suggestedWords: [],
      suggestedGrammars: [g],
      suggestedGradeId: gradeId || "",
      reason: "基于你的学习数据，这个语法点是你的薄弱环节",
      type: "weak_grammar",
    });
  }

  // 2. 新单词推荐（如果学过了一些单词）
  const learnedWords = new Set(Object.keys(profile.wordMastery));
  if (learnedWords.size > 0 && gradeId) {
    // 从随机池里找没学过的单词
    const { WORD_POOL } = require("./types");
    const { WORD_PHRASES } = require("./types");
    const allWords = WORD_POOL[gradeId.startsWith("p")
      ? "primary"
      : gradeId.startsWith("j")
      ? "junior"
      : gradeId.startsWith("s")
      ? "senior"
      : "college"] ?? [];
    const newWords = allWords
      .filter((w: string) => !learnedWords.has(w.toLowerCase()))
      .slice(0, 10);

    if (newWords.length >= 5) {
      recommendations.push({
        title: "探索新词汇",
        description: `你已经掌握了 ${learnedWords.size} 个单词，来学点新的吧！`,
        suggestedWords: newWords.map((w: string) => ({
          word: w,
          phrases: WORD_PHRASES[w.toLowerCase()],
        })),
        suggestedGrammars: weakGrammars.length > 0 ? [weakGrammars[0]] : [],
        suggestedGradeId: gradeId,
        reason: "推荐你尚未学习过的新单词",
        type: "new_words",
      });
    }
  }

  // 3. 复习推荐
  if (profile.history.length >= 3) {
    const oldRecord = profile.history[profile.history.length - 1];
    const oldGrammars = oldRecord.grammarIds
      .map((id) => GRAMMAR_OPTIONS.find((g) => g.id === id))
      .filter(Boolean) as GrammarOption[];

    recommendations.push({
      title: "温故知新",
      description: "复习一下之前的学过的内容，巩固记忆。",
      suggestedWords: oldRecord.words.slice(0, 5).map((w) => ({ word: w })),
      suggestedGrammars: oldGrammars.slice(0, 1),
      suggestedGradeId: oldRecord.gradeId,
      reason: "间隔复习有助于长期记忆",
      type: "review",
    });
  }

  // 4. 继续学习推荐
  if (profile.history.length > 0) {
    const last = profile.history[0];
    const lastGrammars = last.grammarIds
      .map((id) => GRAMMAR_OPTIONS.find((g) => g.id === id))
      .filter(Boolean) as GrammarOption[];

    recommendations.push({
      title: "继续挑战",
      description: "基于你上次的学习内容，继续深入练习。",
      suggestedWords: [],
      suggestedGrammars: lastGrammars.slice(0, 1),
      suggestedGradeId: last.gradeId,
      reason: "延续上次的语法主题",
      type: "continue",
    });
  }

  return recommendations;
}

// 获取学习统计
export function getLearningStats() {
  const profile = getProfile();
  const articles = getArticles();

  return {
    totalArticles: profile.totalArticles,
    streakDays: profile.streakDays,
    masteredWords: Object.keys(profile.wordMastery).length,
    masteredGrammars: Object.keys(profile.grammarMastery).length,
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
