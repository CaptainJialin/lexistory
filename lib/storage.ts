import { Article, UserProgress, QuizResult } from "./types";

const STORAGE_KEY = "lexistory_articles";
const PROGRESS_KEY = "lexistory_progress";
const QUIZ_KEY = "lexistory_quizzes";

export function saveArticle(article: Article): void {
  if (typeof window === "undefined") return;
  const articles = getArticles();
  articles.unshift(article);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
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
    return JSON.parse(raw) as UserProgress;
  } catch {
    return null;
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function markUnitCompleted(unitId: string): void {
  const progress = getProgress();
  if (!progress) return;
  if (!progress.completedUnits.includes(unitId)) {
    progress.completedUnits.push(unitId);
  }
  saveProgress(progress);
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
  generateRecommendations,
  getLearningStats,
  type Recommendation,
} from "./recommend";

export type { UserLearningProfile, LearningRecord } from "./types";
