/** Roll back a synchronous learning operation when a storage write fails (e.g. quota).
 * This protects one tab's operation, not concurrent writes from other tabs or devices.
 */
const keys = ["lexistory_articles", "lexistory_wordbook", "lexistory_grammarbook", "lexistory_profile", "lexistory_daily_goal", "lexistory_reading_progress", "lexistory_progress", "lexistory_quizzes", "lexistory_quiz_grades", "lexistory_quiz_drafts"];

export function withLearningTransaction<T>(operation: () => T): T {
  if (typeof window === "undefined") return operation();
  const before = keys.map((key) => [key, localStorage.getItem(key)] as const);
  try { return operation(); }
  catch (error) {
    // First release space used by new values; restoring originals then fits the old quota.
    const changed = before.filter(([key, value]) => localStorage.getItem(key) !== value);
    for (const [key] of changed) localStorage.removeItem(key);
    for (const [key, value] of changed) if (value !== null) localStorage.setItem(key, value);
    throw error;
  }
}
