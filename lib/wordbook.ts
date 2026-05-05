import { WordBookEntry } from "./types";

const WORDBOOK_KEY = "lexistory_wordbook";

export function getWordBook(): WordBookEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(WORDBOOK_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WordBookEntry[];
  } catch {
    return [];
  }
}

export function saveWordBook(entries: WordBookEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORDBOOK_KEY, JSON.stringify(entries));
}

export function addWord(entry: Omit<WordBookEntry, "id" | "addedAt" | "proficiency" | "reviewCount" | "lastReviewedAt">): WordBookEntry {
  const book = getWordBook();
  const normalizedWord = entry.word.trim().toLowerCase();

  // 去重：如果单词已存在，合并短语
  const existing = book.find((e) => e.word.toLowerCase() === normalizedWord);
  if (existing) {
    const newPhrases = entry.phrases?.filter(
      (p) => !existing.phrases?.includes(p)
    );
    if (newPhrases && newPhrases.length > 0) {
      existing.phrases = [...(existing.phrases || []), ...newPhrases];
      saveWordBook(book);
    }
    return existing;
  }

  const newEntry: WordBookEntry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    word: entry.word.trim(),
    meaning: entry.meaning?.trim(),
    phrases: entry.phrases?.map((p) => p.trim()).filter(Boolean),
    proficiency: 0,
    addedAt: Date.now(),
    lastReviewedAt: null,
    reviewCount: 0,
  };

  book.unshift(newEntry);
  saveWordBook(book);
  return newEntry;
}

export function addWords(
  words: { word: string; meaning?: string; phrases?: string[] }[]
): WordBookEntry[] {
  return words.map((w) => addWord(w));
}

export function removeWord(id: string): void {
  const book = getWordBook().filter((e) => e.id !== id);
  saveWordBook(book);
}

export function updateWordProficiency(id: string, proficiency: number): void {
  const book = getWordBook();
  const entry = book.find((e) => e.id === id);
  if (!entry) return;
  entry.proficiency = Math.max(0, Math.min(3, proficiency));
  entry.lastReviewedAt = Date.now();
  entry.reviewCount += 1;
  saveWordBook(book);
}

export function updateWordMeaning(id: string, meaning: string): void {
  const book = getWordBook();
  const entry = book.find((e) => e.id === id);
  if (!entry) return;
  entry.meaning = meaning.trim();
  saveWordBook(book);
}

export function updateWordPhrases(id: string, phrases: string[]): void {
  const book = getWordBook();
  const entry = book.find((e) => e.id === id);
  if (!entry) return;
  entry.phrases = phrases.map((p) => p.trim()).filter(Boolean);
  saveWordBook(book);
}

export function getWordsNeedingReview(limit: number = 10): WordBookEntry[] {
  const book = getWordBook();
  // 优先返回掌握度低的、很久没复习的
  return book
    .filter((e) => e.proficiency < 3)
    .sort((a, b) => {
      if (a.proficiency !== b.proficiency) return a.proficiency - b.proficiency;
      const aTime = a.lastReviewedAt || a.addedAt;
      const bTime = b.lastReviewedAt || b.addedAt;
      return aTime - bTime;
    })
    .slice(0, limit);
}

export function importToWordBook(
  wordItems: { word: string; meaning?: string; phrases?: string[] }[]
): void {
  wordItems.forEach((item) => addWord(item));
}

export function exportWordBook(): WordBookEntry[] {
  return getWordBook();
}

export function clearWordBook(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WORDBOOK_KEY);
}
