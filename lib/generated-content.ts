import type { QuizQuestion, SentenceAnalysis } from "./types";

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const records = (value: unknown) => Array.isArray(value) ? value.filter(record) : [];
const quizTypes = new Set(["word-meaning", "grammar-fill", "reading-comprehension", "vocabulary-in-context", "detail", "inference", "main-idea", "attitude"]);

/** AI output is untrusted data. Never let malformed optional content break a valid story. */
export function normalizeGeneratedContent(value: unknown) {
  if (!record(value) || !text(value.content)) throw new Error("这次没有生成有效正文，请重试。");
  const quiz: QuizQuestion[] = [];
  for (const question of records(value.quiz).slice(0, 20)) {
    const options = Array.isArray(question.options) ? question.options.map(text) : [];
    const answer = question.correctIndex;
    if (!text(question.question) || options.length < 2 || options.length > 6 || options.some((option) => !option) ||
      typeof answer !== "number" || !Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
    quiz.push({
      id: `q${quiz.length + 1}`, type: quizTypes.has(String(question.type)) ? question.type as QuizQuestion["type"] : "reading-comprehension",
      question: text(question.question), options, correctIndex: answer,
      explanation: text(question.explanation) || "这道题暂缺解析，可以回到原文核对。",
    });
  }
  const wordUsages = Object.fromEntries(record(value.wordUsages)
    ? Object.entries(value.wordUsages).filter(([, meaning]) => text(meaning)).map(([word, meaning]) => [word.toLowerCase(), text(meaning)]) : []);
  return { title: text(value.title) || "新的阅读故事", content: text(value.content), translation: text(value.translation), quiz, wordUsages };
}

export function normalizeSentenceAnalysis(value: unknown): SentenceAnalysis[] {
  return records(value).filter((item) => text(item.sentence)).map((item) => ({
    sentence: text(item.sentence), translation: text(item.translation) || undefined,
    constituents: records(item.constituents).filter((part) => text(part.text) && text(part.label))
      .map((part) => ({ text: text(part.text), label: text(part.label) })),
    difficultWords: records(item.difficultWords).filter((word) => text(word.word) && text(word.meaning))
      .map((word) => ({ word: text(word.word), meaning: text(word.meaning), originalForm: text(word.originalForm), morphologicalNote: text(word.morphologicalNote), partOfSpeech: text(word.partOfSpeech), phonetic: text(word.phonetic) })),
    grammars: records(item.grammars).filter((grammar) => text(grammar.name) && text(grammar.explanation))
      .map((grammar) => ({ name: text(grammar.name), explanation: text(grammar.explanation), grammarId: text(grammar.grammarId) || undefined })),
    phrases: records(item.phrases).filter((phrase) => text(phrase.phrase) && text(phrase.meaning))
      .map((phrase) => ({ phrase: text(phrase.phrase), meaning: text(phrase.meaning) })),
  }));
}
