import { Article, UserProgress, QuizResult } from "./types";

const STORAGE_KEY = "lexistory_articles";
const PROGRESS_KEY = "lexistory_progress";
const QUIZ_KEY = "lexistory_quizzes";

/**
 * 保存文章。
 *
 * 注意：这里刻意 **不再** 把目标词无条件灌进单词本。
 * 入册时机改由 lib/coverage.ts 验证「这个词真的出现在用户读到的文章里」之后触发，
 * 见 registerArticleLearning()。否则单词本会被从未真正出现过的词污染。
 */
export function saveArticle(article: Article): void {
  if (typeof window === "undefined") return;
  const articles = getArticles();
  articles.unshift(article);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

export function updateArticle(article: Article): void {
  if (typeof window === "undefined") return;
  const articles = getArticles().map((a) => (a.id === article.id ? article : a));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

export function getArticleById(id: string): Article | undefined {
  return getArticles().find((a) => a.id === id);
}

export function getArticles(): Article[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Article[];
  } catch {
    return [];
  }
}

export function deleteArticle(id: string): void {
  if (typeof window === "undefined") return;
  const articles = getArticles().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

// ====== 用户学习进度 ======
export function getProgress(): UserProgress | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (!raw) return null;
  try {
    return normalizeProgress(JSON.parse(raw) as UserProgress);
  } catch {
    return null;
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(normalizeProgress(progress)));
}

function normalizeProgress(progress: UserProgress): UserProgress {
  return {
    ...progress,
    completedUnits: Array.isArray(progress.completedUnits)
      ? progress.completedUnits
      : [],
    unitStates: progress.unitStates ?? {},
  };
}

export function markUnitCompleted(unitId: string): void {
  const progress = getProgress();
  if (!progress) return;
  if (!progress.completedUnits.includes(unitId)) {
    progress.completedUnits.push(unitId);
  }
  saveProgress(progress);
}

export function recordUnitQuizOutcome(
  unitId: string,
  result: QuizResult,
  passed: boolean
): void {
  const progress = getProgress();
  if (!progress) return;

  const previous = progress.unitStates?.[unitId];
  const unitStates = progress.unitStates ?? {};
  const bestScore = Math.max(previous?.bestScore ?? 0, result.score);

  unitStates[unitId] = {
    status: passed ? "completed" : "review",
    bestScore,
    lastScore: result.score,
    articleId: result.articleId,
    wrongQuestions: result.wrongQuestions,
    updatedAt: result.completedAt,
  };

  if (passed && !progress.completedUnits.includes(unitId)) {
    progress.completedUnits.push(unitId);
  }

  saveProgress({ ...progress, unitStates });
}

// ====== 测验结果 ======
export function getQuizResults(): QuizResult[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(QUIZ_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QuizResult[];
  } catch {
    return [];
  }
}

export function saveQuizResult(result: QuizResult): void {
  if (typeof window === "undefined") return;
  const results = getQuizResults();
  results.push(result);
  localStorage.setItem(QUIZ_KEY, JSON.stringify(results));
}

// 获取某单元的测验结果
export function getQuizResultByUnit(unitId: string): QuizResult | undefined {
  const results = getQuizResults();
  return results.find((r) => r.unitId === unitId);
}

// Re-export recommend functions for convenience
export {
  getProfile,
  saveProfile,
  recordArticleRead,
  recordSentenceClick,
  getLearningStats,
} from "./recommend";

export type { UserLearningProfile, LearningRecord } from "./types";
