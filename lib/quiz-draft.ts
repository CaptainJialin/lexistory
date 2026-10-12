import type { Article, QuizResult } from "./types";

const KEY = "lexistory_quiz_drafts";
export interface QuizDraft {
  signature: string;
  answers: number[];
  updatedAt: number;
  result?: QuizResult;
}
const signature = (article: Article) => JSON.stringify(article.quiz ?? []);
function readDrafts(): Record<string, QuizDraft> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function getQuizDraft(article: Article): QuizDraft | null {
  const draft = readDrafts()[article.id];
  const quiz = article.quiz ?? [];
  if (!draft || draft.signature !== signature(article) || !Array.isArray(draft.answers) ||
    draft.answers.length > quiz.length || !Number.isFinite(draft.updatedAt) ||
    !draft.answers.every((answer, index) => Number.isInteger(answer) && answer >= 0 && answer < quiz[index].options.length)) return null;
  // Recompute displayed scores from the saved choices instead of trusting imported totals.
  if (draft.result && draft.answers.length === quiz.length) {
    return { ...draft, result: createQuizResult(article, draft.answers, draft.updatedAt) };
  }
  return { ...draft, result: undefined };
}

export function saveQuizDraft(article: Article, answers: number[], result?: QuizResult): void {
  const drafts = readDrafts();
  drafts[article.id] = { signature: signature(article), answers: [...answers], updatedAt: Date.now(), result };
  // Bound cached sessions. Learning results remain in the separate permanent history.
  const recent = Object.entries(drafts).filter(([, draft]) => draft && Number.isFinite(draft.updatedAt))
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(recent)));
}

export function clearQuizDraft(articleId: string): void {
  const drafts = readDrafts(); delete drafts[articleId];
  localStorage.setItem(KEY, JSON.stringify(drafts));
}

export function createQuizResult(article: Article, answers: number[], now = Date.now()): QuizResult {
  const quiz = article.quiz ?? [];
  if (!quiz.length || answers.length !== quiz.length || answers.some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer >= quiz[index].options.length)) {
    throw new Error("请先完成所有题目。");
  }
  const wrongQuestions = quiz.filter((question, index) => answers[index] !== question.correctIndex).map((question) => question.id);
  return { articleId: article.id, unitId: article.source?.unitId ?? "", totalQuestions: quiz.length,
    correctCount: quiz.length - wrongQuestions.length, score: Math.round((quiz.length - wrongQuestions.length) / quiz.length * 100), wrongQuestions, completedAt: now };
}
