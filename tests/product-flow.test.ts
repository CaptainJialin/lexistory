import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { openDemoArticle } from "../lib/demo-article";
import { getArticles, saveArticle, deleteArticle, getQuizResults, saveQuizResult } from "../lib/storage";
import { generateArticleFromPlan } from "../lib/generate-article";
import { analyzeArticle } from "../lib/analyze-article";
import { buildLessonPlan } from "../lib/lesson-plan";
import { normalizeGeneratedContent, normalizeSentenceAnalysis } from "../lib/generated-content";
import { registerArticleLearning, applyQuizOutcome } from "../lib/learning";
import { getGrammarBook } from "../lib/grammarbook";
import { getWordBook, gradeWord, recordWordExposure } from "../lib/wordbook";
import { getProfile } from "../lib/recommend";
import { beginDailyReview, recordReviewForGoal, getDailyProgress } from "../lib/daily-goal";
import { countClozeAvailable } from "../lib/cloze";
import { getQuizDraft, saveQuizDraft, createQuizResult } from "../lib/quiz-draft";
import { withLearningTransaction } from "../lib/learning-transaction";
import type { Article } from "../lib/types";

class MemoryStorage implements Storage {
  map = new Map<string, string>();
  failKey: string | null = null;
  get length() { return this.map.size; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.get(key) ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) {
    if (this.failKey === key) { this.failKey = null; throw new Error("Quota exceeded"); }
    this.map.set(key, value);
  }
}
let storage: MemoryStorage;
let demo: Article;
const originalFetch = globalThis.fetch;
beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  openDemoArticle(); demo = getArticles()[0];
});
afterEach(() => { globalThis.fetch = originalFetch; });

test("a generated story is saved and returned before any analysis request", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (url) => { calls.push(String(url)); return Response.json(demo); };
  const article = await generateArticleFromPlan(buildLessonPlan({ progress: null, customWords: [{ word: "path" }] }));
  assert.deepEqual(calls, ["/api/generate"]);
  assert.equal(article.analysisStatus, "pending"); assert.deepEqual(article.sentences, []);
  assert.equal(getArticles()[0].id, article.id);
});

test("cancelling generation before it resolves cannot save an unwanted story", async () => {
  const controller = new AbortController();
  globalThis.fetch = async () => { controller.abort(); return Response.json(demo); };
  await assert.rejects(generateArticleFromPlan(buildLessonPlan({ progress: null, customWords: [{ word: "path" }] }), { signal: controller.signal }));
  assert.equal(getArticles().length, 1);
});

test("analysis retries only missing sentences and keeps previous translations", async () => {
  const pending: Article = { ...demo, sentences: [demo.sentences![0]], analysisStatus: "pending" };
  saveArticle(pending);
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options!.body as string);
    assert.equal(request.content.includes(demo.sentences![0].sentence), false);
    return Response.json({ sentences: demo.sentences!.slice(1) });
  };
  const updated = await analyzeArticle(pending, new AbortController().signal);
  assert.equal(updated.analysisStatus, "ready");
  assert.equal(updated.sentences?.length, 4);
  assert.equal(updated.sentences![0].translation, demo.sentences![0].translation);
});

test("cancelled and deleted stories cannot be overwritten by a late analysis response", async () => {
  const pending: Article = { ...demo, sentences: [], analysisStatus: "pending" };
  saveArticle(pending);
  const controller = new AbortController();
  globalThis.fetch = async () => { controller.abort(); return Response.json({ sentences: demo.sentences }); };
  await assert.rejects(analyzeArticle(pending, controller.signal));
  assert.deepEqual(getArticles()[0].sentences, []);
  globalThis.fetch = async () => { deleteArticle(demo.id); return Response.json({ sentences: demo.sentences }); };
  await assert.rejects(analyzeArticle(pending, new AbortController().signal));
  assert.equal(getArticles().length, 0);
});

test("analysis errors and unrelated model sentences leave the readable story intact", async () => {
  const pending: Article = { ...demo, sentences: [], analysisStatus: "pending" };
  saveArticle(pending);
  globalThis.fetch = async () => Response.json({ sentences: [{ sentence: "This is not the original story.", translation: "无关的句子" }] });
  await assert.rejects(analyzeArticle(pending, new AbortController().signal));
  assert.deepEqual(getArticles()[0], pending);
  globalThis.fetch = async () => Response.json({ error: "稍后再试" }, { status: 503 });
  await assert.rejects(analyzeArticle(pending, new AbortController().signal), /稍后再试/);
  assert.deepEqual(getArticles()[0], pending);
});

test("grammar arriving after completion is recorded without double word exposure or read credit", async () => {
  const pending: Article = { ...demo, sentences: [], analysisStatus: "pending" };
  saveArticle(pending); registerArticleLearning(pending);
  const words = getWordBook();
  assert.equal(getGrammarBook().length, 0);
  globalThis.fetch = async () => Response.json({ sentences: demo.sentences });
  await analyzeArticle(pending, new AbortController().signal);
  assert.equal(getGrammarBook().length, 1);
  assert.deepEqual(getWordBook(), words);
  assert.equal(getProfile().totalArticles, 1);
});

test("malformed AI quiz answers and nested analyses cannot enter interactive UI", () => {
  const result = normalizeGeneratedContent({ ...demo, title: {}, quiz: [null, { ...demo.quiz![0], correctIndex: 10 }, { ...demo.quiz![1], options: [null, "ok"] }, demo.quiz![2]] });
  assert.equal(result.quiz.length, 1); assert.equal(result.title, "新的阅读故事");
  assert.deepEqual(normalizeSentenceAnalysis([null, {}, { sentence: "Hello.", grammars: [null, { name: "test" }], constituents: {}, difficultWords: [1] }])[0].grammars, []);
});

test("confirmed quiz answers survive reload and completed results can be reopened", () => {
  saveQuizDraft(demo, [0]); assert.deepEqual(getQuizDraft(demo)?.answers, [0]);
  const result = createQuizResult(demo, [0, 1, 2]);
  saveQuizDraft(demo, [0, 1, 2], result);
  assert.equal(getQuizDraft(demo)?.result?.score, 100);
  assert.throws(() => createQuizResult(demo, [0]), /完成所有题目/);
});

test("quiz drafts reject changed questions, invalid choices and malformed imports", () => {
  saveQuizDraft(demo, [0]);
  assert.equal(getQuizDraft({ ...demo, quiz: [{ ...demo.quiz![0], options: ["changed", "options"] }] }), null);
  saveQuizDraft(demo, [999]); assert.equal(getQuizDraft(demo), null);
  storage.setItem("lexistory_quiz_drafts", "null"); assert.equal(getQuizDraft(demo), null);
});

test("failed reading writes roll back exposures and counters, allowing a clean retry", () => {
  const before = new Map(storage.map);
  storage.failKey = "lexistory_daily_goal";
  assert.throws(() => registerArticleLearning(demo));
  assert.deepEqual(storage.map, before);
  registerArticleLearning(demo);
  assert.equal(getProfile().totalArticles, 1);
  assert.ok(getWordBook().every((entry) => entry.srs?.exposures === 1));
});

test("failed quiz completion restores result history, SRS and saved draft together", () => {
  registerArticleLearning(demo); saveQuizDraft(demo, [0, 1, 2]);
  const before = new Map(storage.map); const result = createQuizResult(demo, [0, 1, 2]);
  storage.failKey = "lexistory_quiz_drafts";
  assert.throws(() => withLearningTransaction(() => {
    saveQuizResult(result); applyQuizOutcome(demo, [0, 1, 2], result); saveQuizDraft(demo, [0, 1, 2], result);
  }));
  assert.deepEqual(storage.map, before); assert.equal(getQuizResults().length, 0);
  assert.equal(getQuizDraft(demo)?.answers.length, 3);
});

test("daily review target stays fixed as correct answers reduce the due queue", () => {
  registerArticleLearning(demo);
  const tomorrow = Date.now() + 86400000;
  const target = getDailyProgress(tomorrow).reviewTarget;
  assert.equal(target, 4);
  beginDailyReview(tomorrow);
  const words = getWordBook();
  words.forEach((entry) => { gradeWord(entry.id, "good", tomorrow); recordReviewForGoal(1, tomorrow); });
  assert.equal(countClozeAvailable(tomorrow).due, 0);
  assert.equal(getDailyProgress(tomorrow).reviewTarget, target);
  assert.equal(getDailyProgress(tomorrow).reviewsDone, target);
});

test("unusable tiny sentences are excluded from achievable review goals", () => {
  const short = { ...demo, id: "short", content: "A seed.", sentences: [{ sentence: "A seed." }] };
  deleteArticle(demo.id); saveArticle(short); recordWordExposure("seed", short.id);
  assert.equal(countClozeAvailable().total, 0);
  assert.equal(getDailyProgress().reviewTarget, 0);
});
