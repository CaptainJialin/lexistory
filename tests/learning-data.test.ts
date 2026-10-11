import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildBackup, collectStorage, importBackup, inspectBackup, undoLastImport } from "../lib/backup";
import { localDateKey, calendarDayDistance } from "../lib/calendar";
import { recordArticleReadForGoal, getDailyProgress, recordReviewForGoal } from "../lib/daily-goal";
import { registerArticleLearning, applyQuizOutcome } from "../lib/learning";
import { getProfile, getLearningStats, recordArticleRead } from "../lib/recommend";
import { openDemoArticle } from "../lib/demo-article";
import { getArticles } from "../lib/storage";
import { getReadingProgress, saveReadingProgress, getContinueReading } from "../lib/reading-progress";
import { readableSentences } from "../lib/reader-sentences";

class MemoryStorage implements Storage {
  map = new Map<string, string>();
  failKey: string | null = null;
  get length() { return this.map.size; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.get(key) ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { if (this.failKey === key) { this.failKey = null; throw new Error("Quota exceeded"); } this.map.set(key, value); }
}
let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  storage.setItem("lexistory_schema_version", "3");
});

test("local study day follows the user's calendar and handles year boundaries", () => {
  const date = new Date(2026, 9, 11, 0, 15);
  assert.equal(localDateKey(date.getTime()), "2026-10-11");
  assert.equal(calendarDayDistance("2025-12-31", "2026-01-01"), 1);
});
test("opening or bookmarking a story does not mark it read", () => {
  const id = openDemoArticle(); saveReadingProgress(id, { sentenceIndex: 2 });
  assert.equal(getProfile().totalArticles, 0); assert.equal(getDailyProgress().articlesRead, 0);
  assert.equal(getContinueReading()?.article.id, id); assert.equal(getReadingProgress(id)?.sentenceIndex, 2);
});
test("missing or mismatched AI analysis does not remove sentence interactions", () => {
  openDemoArticle(); const article = getArticles()[0];
  assert.equal(readableSentences({ ...article, sentences: [] }).length, 4);
  const partial = readableSentences({ ...article, sentences: [article.sentences![1]] });
  assert.equal(partial.length, 4); assert.equal(partial[1].translation, article.sentences![1].translation);
  assert.equal(partial[0].translation, undefined);
});
test("completing a story twice only credits it once, including word exposure", () => {
  openDemoArticle(); const article = getArticles()[0]; registerArticleLearning(article);
  const words = storage.getItem("lexistory_wordbook"); registerArticleLearning(article);
  assert.equal(getProfile().totalArticles, 1); assert.equal(getDailyProgress().articlesRead, 1);
  assert.equal(storage.getItem("lexistory_wordbook"), words); assert.equal(getContinueReading(), null);
});
test("daily goals deduplicate an article and reset at local midnight", () => {
  const now = new Date(2026, 9, 11, 23, 59).getTime();
  recordArticleReadForGoal("one", now); recordArticleReadForGoal("one", now);
  assert.equal(getDailyProgress(now).articlesRead, 1); assert.equal(getDailyProgress(now + 120000).articlesRead, 0);
});
test("repeating the same quiz on one day does not repeatedly promote mastery", () => {
  openDemoArticle(); const article = getArticles()[0]; registerArticleLearning(article);
  const result = { unitId: "", articleId: article.id, score: 100, totalQuestions: 3, correctCount: 3, wrongQuestions: [], completedAt: Date.now() };
  applyQuizOutcome(article, [0, 1, 2], result);
  const before = storage.getItem("lexistory_wordbook");
  applyQuizOutcome(article, [0, 1, 2], { ...result, completedAt: Date.now() + 1000 });
  assert.equal(storage.getItem("lexistory_wordbook"), before);
});
test("reviews count as study days and expired streaks do not remain displayed", () => {
  const old = new Date(); old.setDate(old.getDate() - 3);
  recordReviewForGoal(1, old.getTime()); assert.equal(getLearningStats().streakDays, 0);
  recordReviewForGoal(); assert.equal(getLearningStats().streakDays, 1);
});
test("total articles remains correct beyond 100 and IDs remain deduplicated", () => {
  for (let i = 0; i < 102; i++) recordArticleRead(String(i), [], [], "j1");
  recordArticleRead("0", [], [], "j1"); assert.equal(getProfile().totalArticles, 102);
});
test("invalid, null and malformed backups leave all existing records intact", () => {
  openDemoArticle(); const before = collectStorage();
  for (const data of [null, [], {}, { lexistory_articles: "null" }, { lexistory_articles: JSON.stringify([{ id: "broken" }]) }]) {
    const result = importBackup(JSON.stringify({ app: "lexistory", schemaVersion: 3, data }));
    assert.equal(result.ok, false); assert.deepEqual(collectStorage(), before);
  }
});
test("backup preview reports actual counts and rejects future schema versions", () => {
  openDemoArticle(); const payload = buildBackup(); assert.equal(inspectBackup(JSON.stringify(payload)).articles, 1);
  assert.throws(() => inspectBackup(JSON.stringify({ ...payload, schemaVersion: 999 })));
});
test("every import gets a fresh, reversible recovery snapshot", () => {
  openDemoArticle(); const original = collectStorage();
  const backup = buildBackup(); backup.data.lexistory_articles = "[]";
  assert.equal(importBackup(JSON.stringify(backup)).ok, true); assert.equal(getArticles().length, 0);
  assert.equal(undoLastImport().ok, true); assert.deepEqual(collectStorage(), original);
});
test("quota failure rolls back a partially written import", () => {
  openDemoArticle(); const before = collectStorage(); const backup = buildBackup();
  backup.data.lexistory_articles = "[]"; storage.failKey = "lexistory_articles";
  assert.equal(importBackup(JSON.stringify(backup)).ok, false); assert.deepEqual(collectStorage(), before);
});
