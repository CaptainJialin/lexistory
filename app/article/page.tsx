"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Article, SentenceAnalysis, SentenceConstituent, LEVEL_LABELS, getGradeById, PROFICIENCY_LABELS, THEME_LABELS, STYLE_LABELS, type WordItem, type QuizQuestion, type QuizResult, type GrammarPattern } from "@/lib/types";
import { getArticles, saveArticle, recordArticleRead, recordSentenceClick, saveQuizResult } from "@/lib/storage";
import { getWordBook, updateWordProficiency } from "@/lib/wordbook";
import { ArrowLeft, RotateCcw, BookOpen, ChevronDown, ChevronUp, X, Loader2, Sparkles, Target, CheckCircle2, XCircle, Trophy, RotateCcw as RefreshCw, Languages } from "lucide-react";

interface HighlightMatch {
  text: string;
  type: "phrase" | "word";
  start: number;
  end: number;
}

function findHighlights(text: string, words: WordItem[]): HighlightMatch[] {
  const matches: HighlightMatch[] = [];
  const lowerText = text.toLowerCase();

  // 1. 先匹配短语（优先级高）
  for (const wordItem of words) {
    if (wordItem.phrases) {
      for (const phrase of wordItem.phrases) {
        const lowerPhrase = phrase.toLowerCase();
        let idx = lowerText.indexOf(lowerPhrase);
        while (idx !== -1) {
          matches.push({
            text: text.slice(idx, idx + phrase.length),
            type: "phrase",
            start: idx,
            end: idx + phrase.length,
          });
          idx = lowerText.indexOf(lowerPhrase, idx + 1);
        }
      }
    }
  }

  // 2. 再匹配单词（整词匹配，避免部分匹配）
  for (const wordItem of words) {
    const word = wordItem.word;
    const lowerWord = word.toLowerCase();
    let idx = lowerText.indexOf(lowerWord);
    while (idx !== -1) {
      const prevChar = idx > 0 ? text[idx - 1] : "";
      const nextChar =
        idx + word.length < text.length ? text[idx + word.length] : "";
      const isWholeWord =
        !/[a-zA-Z]/.test(prevChar) && !/[a-zA-Z]/.test(nextChar);

      if (isWholeWord) {
        const overlapping = matches.some(
          (m) => idx < m.end && idx + word.length > m.start
        );
        if (!overlapping) {
          matches.push({
            text: text.slice(idx, idx + word.length),
            type: "word",
            start: idx,
            end: idx + word.length,
          });
        }
      }
      idx = lowerText.indexOf(lowerWord, idx + 1);
    }
  }

  // 3. 排序并合并重叠
  matches.sort((a, b) => a.start - b.start);
  const merged: HighlightMatch[] = [];
  for (const match of matches) {
    const last = merged[merged.length - 1];
    if (last && match.start < last.end) {
      if (match.type === "phrase" && last.type === "word") {
        merged[merged.length - 1] = match;
      }
    } else {
      merged.push(match);
    }
  }

  return merged;
}

function renderHighlightedText(text: string, words: WordItem[]): React.ReactNode[] {
  const matches = findHighlights(text, words);
  if (matches.length === 0) return [text];

  const result: React.ReactNode[] = [];
  let lastEnd = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (match.start > lastEnd) {
      result.push(
        <span key={`plain-${i}`}>{text.slice(lastEnd, match.start)}</span>
      );
    }
    result.push(
      <mark
        key={`hl-${i}`}
        className={
          match.type === "phrase"
            ? "rounded-sm bg-amber-200 px-0.5 font-medium text-amber-900"
            : "rounded-sm bg-yellow-100 px-0.5 text-yellow-800"
        }
      >
        {match.text}
      </mark>
    );
    lastEnd = match.end;
  }

  if (lastEnd < text.length) {
    result.push(<span key="plain-end">{text.slice(lastEnd)}</span>);
  }

  return result;
}

function SentenceBlock({
  text,
  analysis,
  isSelected,
  onSelect,
  words,
  showTranslation,
}: {
  text: string;
  analysis?: SentenceAnalysis;
  isSelected: boolean;
  onSelect: () => void;
  words: WordItem[];
  showTranslation?: boolean;
}) {
  const highlighted = useMemo(
    () => renderHighlightedText(text, words),
    [text, words]
  );

  if (showTranslation && analysis?.translation) {
    return (
      <span className="inline-block align-top">
        <span
          onClick={onSelect}
          className={`cursor-pointer rounded px-0.5 transition-colors ${
            isSelected
              ? "bg-blue-100 text-blue-900"
              : analysis
              ? "hover:bg-blue-50"
              : ""
          }`}
          title={analysis ? "点击查看句子解析" : undefined}
        >
          {highlighted}
        </span>
        <span className="block text-sm text-zinc-500 mt-0.5 mb-2 leading-relaxed">
          {analysis.translation}
        </span>
      </span>
    );
  }

  return (
    <span
      onClick={onSelect}
      className={`cursor-pointer rounded px-0.5 transition-colors ${
        isSelected
          ? "bg-blue-100 text-blue-900"
          : analysis
          ? "hover:bg-blue-50"
          : ""
      }`}
      title={analysis ? "点击查看句子解析" : undefined}
    >
      {highlighted}
    </span>
  );
}

const PROFICIENCY_COLORS = [
  "bg-red-50 text-red-700 border-red-200",
  "bg-orange-50 text-orange-700 border-orange-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-green-50 text-green-700 border-green-200",
];

// 渲染带成分标注的句子（在原句各部分下方显示标签）
function renderAnnotatedSentence(
  sentence: string,
  constituents?: SentenceConstituent[]
): React.ReactNode {
  if (!constituents || constituents.length === 0) return sentence;

  // 找到每个 constituent 在原句中的位置
  const positioned = constituents
    .map((c) => {
      const start = sentence.indexOf(c.text);
      return start !== -1
        ? { ...c, start, end: start + c.text.length }
        : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.start - b.start);

  // 合并重叠：保留更长的
  const merged: typeof positioned = [];
  for (const c of positioned) {
    const last = merged[merged.length - 1];
    if (last && c.start < last.end) {
      if (c.end - c.start > last.end - last.start) {
        merged[merged.length - 1] = c;
      }
    } else {
      merged.push(c);
    }
  }

  const result: React.ReactNode[] = [];
  let lastEnd = 0;

  for (let i = 0; i < merged.length; i++) {
    const c = merged[i];
    if (c.start > lastEnd) {
      result.push(
        <span key={`plain-${i}`} className="inline-block align-bottom">
          {sentence.slice(lastEnd, c.start)}
        </span>
      );
    }
    result.push(
      <span key={`anno-${i}`} className="inline-block align-bottom mx-0.5">
        <span className="block text-sm text-zinc-800 leading-snug">{c.text}</span>
        <span className="block mt-0.5 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-700 leading-tight">
          {c.label}
        </span>
      </span>
    );
    lastEnd = c.end;
  }

  if (lastEnd < sentence.length) {
    result.push(
      <span key="plain-end" className="inline-block align-bottom">
        {sentence.slice(lastEnd)}
      </span>
    );
  }

  return <>{result}</>;
}

function WordProficiencyPopup({
  word,
  articleWords,
  wordUsages,
  onClose,
}: {
  word: string;
  articleWords: WordItem[];
  wordUsages?: Record<string, string>;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState<ReturnType<typeof getWordBook>[number] | null>(null);

  useEffect(() => {
    const book = getWordBook();
    const found = book.find((e) => e.word.toLowerCase() === word.toLowerCase());
    setEntry(found || null);
  }, [word]);

  const wordItem = articleWords.find(
    (w) => w.word.toLowerCase() === word.toLowerCase()
  );

  const handleSetProficiency = (level: number) => {
    if (!entry) return;
    updateWordProficiency(entry.id, level);
    setEntry({ ...entry, proficiency: level });
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[90%] max-w-md -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-zinc-900">{word}</span>
          {wordItem?.meaning && (
            <span className="text-sm text-zinc-500">{wordItem.meaning}</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          关闭
        </Button>
      </div>

      {/* AI 生成释义 */}
      {wordUsages && wordUsages[word.toLowerCase()] && (
        <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="font-medium">释义：</span>
          {wordUsages[word.toLowerCase()]}
        </div>
      )}

      {wordItem?.phrases && wordItem.phrases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {wordItem.phrases.map((p, i) => (
            <Badge key={i} variant="outline" className="text-[10px] text-zinc-500">
              {p}
            </Badge>
          ))}
        </div>
      )}

      {entry ? (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-zinc-500">标记掌握度：</p>
          <div className="flex gap-2">
            {PROFICIENCY_LABELS.map((label, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSetProficiency(idx)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                  entry.proficiency === idx
                    ? PROFICIENCY_COLORS[idx]
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-400">
            已复习 {entry.reviewCount} 次
            {entry.lastReviewedAt &&
              ` · 上次 ${new Date(entry.lastReviewedAt).toLocaleDateString("zh-CN")}`}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-400">
          该单词不在你的单词本中。生成文章时使用的单词会自动加入单词本。
        </p>
      )}
    </div>
  );
}

// ====== 测验面板 ======
function QuizPanel({ article }: { article: Article }) {
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const quiz = article.quiz;
  if (!quiz || quiz.length === 0) return null;

  const currentQ = quiz[currentIdx];
  const total = quiz.length;
  const correctCount = answers.filter((a, i) => a === quiz[i].correctIndex).length;

  function handleSelect(idx: number) {
    if (showAnswer) return;
    setSelectedOption(idx);
  }

  function handleConfirm() {
    if (selectedOption === null) return;
    setShowAnswer(true);
    setAnswers((prev) => [...prev, selectedOption]);
  }

  function handleNext() {
    if (currentIdx < total - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(null);
      setShowAnswer(false);
    } else {
      setFinished(true);
      // 保存测验结果
      const result: QuizResult = {
        unitId: "",
        articleId: article.id,
        score: Math.round((correctCount / total) * 100),
        totalQuestions: total,
        correctCount: correctCount,
        wrongQuestions: answers
          .map((a, i) => (a !== article.quiz![i].correctIndex ? article.quiz![i].id : null))
          .filter(Boolean) as string[],
        completedAt: Date.now(),
      };
      saveQuizResult(result);
    }
  }

  function handleRestart() {
    setStarted(false);
    setCurrentIdx(0);
    setSelectedOption(null);
    setShowAnswer(false);
    setAnswers([]);
    setFinished(false);
  }

  // Not started
  if (!started) {
    return (
      <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5 text-indigo-600" />
          <h3 className="text-base font-semibold text-zinc-900">Quiz</h3>
        </div>
        <p className="text-sm text-zinc-600 mb-4">
          {total} questions to check your understanding.
        </p>
        <Button onClick={() => setStarted(true)} className="gap-1">
          <Target className="h-4 w-4" />
          Start Quiz
        </Button>
      </div>
    );
  }

  // Finished
  if (finished) {
    const allCorrect = correctCount === total;
    return (
      <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <Trophy className="h-7 w-7 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">
            {allCorrect ? "Perfect! All correct!" : "Quiz Complete"}
          </h3>
          <p className="mt-1 text-3xl font-bold text-indigo-600">
            {correctCount}/{total}
          </p>
          <p className="text-sm text-zinc-500">
            {allCorrect
              ? "You've mastered the content. Great job!"
              : "Review the mistakes and strengthen weak areas."}
          </p>
          <Button onClick={handleRestart} variant="outline" className="mt-4 gap-1">
            <RefreshCw className="h-4 w-4" />
            Retake
          </Button>
        </div>
      </div>
    );
  }

  // Answering
  const isCorrect = selectedOption === currentQ.correctIndex;

  return (
    <div className="mt-6 rounded-xl border border-indigo-200 bg-white p-6 shadow-sm">
      {/* Progress */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">
          Question {currentIdx + 1} / {total}
        </span>
        <div className="h-1.5 flex-1 mx-3 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${((currentIdx + (showAnswer ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-1">
        <Badge variant="outline" className="mb-2 text-[10px]">
          {currentQ.type === "word-meaning"
            ? "Vocabulary"
            : currentQ.type === "grammar-fill"
            ? "Grammar"
            : "Reading"}
        </Badge>
        <p className="text-base font-medium text-zinc-900">{currentQ.question}</p>
      </div>

      {/* Options */}
      <div className="mt-4 space-y-2">
        {currentQ.options.map((opt, idx) => {
          let optionClass =
            "w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ";
          if (showAnswer) {
            if (idx === currentQ.correctIndex) {
              optionClass +=
                "border-green-300 bg-green-50 text-green-800 font-medium";
            } else if (idx === selectedOption) {
              optionClass +=
                "border-red-300 bg-red-50 text-red-800";
            } else {
              optionClass +=
                "border-zinc-200 bg-white text-zinc-500";
            }
          } else {
            optionClass +=
              selectedOption === idx
                ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50";
          }

          return (
            <button
              key={idx}
              className={optionClass}
              onClick={() => handleSelect(idx)}
              disabled={showAnswer}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{opt}</span>
                {showAnswer && idx === currentQ.correctIndex && (
                  <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />
                )}
                {showAnswer && idx === selectedOption && idx !== currentQ.correctIndex && (
                  <XCircle className="ml-auto h-4 w-4 text-red-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showAnswer && (
        <div
          className={`mt-3 rounded-lg px-4 py-3 text-sm ${
            isCorrect
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-medium">{isCorrect ? "Correct!" : "Incorrect"}</p>
          <p className="mt-0.5 text-zinc-700">{currentQ.explanation}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex justify-end">
        {!showAnswer ? (
          <Button onClick={handleConfirm} disabled={selectedOption === null}>
            Confirm
          </Button>
        ) : (
          <Button onClick={handleNext}>
            {currentIdx < total - 1 ? "Next" : "See Results"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ArticleLearningReport({ article }: { article: Article }) {
  const [collapsed, setCollapsed] = useState(true);
  const book = useMemo(() => getWordBook(), []);

  const wordStats = useMemo(() => {
    return article.words.map((w) => {
      const lower = w.word.toLowerCase();
      const content = article.content.toLowerCase();
      let count = 0;
      let idx = content.indexOf(lower);
      while (idx !== -1) {
        const prev = idx > 0 ? article.content[idx - 1] : "";
        const next =
          idx + w.word.length < article.content.length
            ? article.content[idx + w.word.length]
            : "";
        if (!/[a-zA-Z]/.test(prev) && !/[a-zA-Z]/.test(next)) {
          count++;
        }
        idx = content.indexOf(lower, idx + 1);
      }
      const entry = book.find((e) => e.word.toLowerCase() === lower);
      return {
        word: w.word,
        count,
        proficiency: entry?.proficiency ?? 0,
        meaning: w.meaning || entry?.meaning,
      };
    });
  }, [article, book]);

  const needReview = wordStats.filter((w) => w.proficiency < 3);

  const router = useRouter();

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-3 flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-zinc-900">学习报告</h3>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {!collapsed && <>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-md bg-white p-2 text-center">
          <p className="text-lg font-bold text-zinc-900">{article.words.length}</p>
          <p className="text-[10px] text-zinc-500">目标单词</p>
        </div>
        <div className="rounded-md bg-white p-2 text-center">
          <p className="text-lg font-bold text-zinc-900">
            {wordStats.reduce((sum, w) => sum + w.count, 0)}
          </p>
          <p className="text-[10px] text-zinc-500">出现次数</p>
        </div>
        <div className="rounded-md bg-white p-2 text-center">
          <p className="text-lg font-bold text-zinc-900">{needReview.length}</p>
          <p className="text-[10px] text-zinc-500">需复习</p>
        </div>
      </div>

      <div className="mb-3 space-y-1">
        {wordStats.map((w) => (
          <div
            key={w.word}
            className="flex items-center justify-between rounded-md bg-white px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-900">{w.word}</span>
              {w.meaning && (
                <span className="text-xs text-zinc-400">{w.meaning}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">出现 {w.count} 次</span>
              <Badge
                variant="outline"
                className={`text-[10px] ${PROFICIENCY_COLORS[w.proficiency]}`}
              >
                {PROFICIENCY_LABELS[w.proficiency]}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {needReview.length > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
          onClick={() => router.push("/")}
        >
          <Target className="h-3.5 w-3.5" />
          去首页用这些单词生成复习文章
        </Button>
      )}
      </>}
    </div>
  );
}

function ArticleViewer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const [article, setArticle] = useState<Article | null>(null);
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<SentenceAnalysis | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [bilingualMode, setBilingualMode] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  async function handleRegenerate() {
    if (!article) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          words: article.words,
          grammars: article.grammar,
          grade,
          theme: article.theme,
          style: article.style,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");

      const newArticle = {
        id: Date.now().toString(),
        title: data.title || "无标题",
        content: data.content || "",
        translation: data.translation || "",
        words: article.words,
        grammar: article.grammar,
        difficulty: article.difficulty,
        sentences: Array.isArray(data.sentences) ? data.sentences : [],
        quiz: Array.isArray(data.quiz) ? data.quiz : [],
        wordUsages: data.wordUsages || {},
        theme: article.theme,
        style: article.style,
        createdAt: Date.now(),
      };
      saveArticle(newArticle);
      router.push(`/article?id=${newArticle.id}`);
    } catch {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    if (!id) {
      router.push("/");
      return;
    }
    const articles = getArticles();
    const found = articles.find((a) => a.id === id);
    if (found) {
      setArticle(found);
      setRegenerating(false); // 新文章加载完成，重置 loading 状态
      // 记录阅读行为（延迟记录，避免误触）
      const timer = setTimeout(() => {
        recordArticleRead(
          found.id,
          found.words,
          found.grammar,
          found.difficulty.gradeId,
          0,
          0
        );
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      router.push("/");
    }
  }, [id, router]);

  const wordSet = useMemo(() => {
    if (!article) return new Set<string>();
    return new Set(article.words.map((w) => w.word.toLowerCase()));
  }, [article]);

  // 把 content 渲染为带交互句子的段落
  const contentNodes = useMemo(() => {
    if (!article) return null;

    const paragraphs = article.content.split("\n\n").filter((p) => p.trim());
    const sentences = article.sentences || [];
    let sentencePtr = 0;

    return paragraphs.map((paragraph, pIdx) => {
      const elements: React.ReactNode[] = [];
      let remaining = paragraph;
      let keyCounter = 0;

      while (remaining && sentencePtr < sentences.length) {
        const s = sentences[sentencePtr];
        const idx = remaining.indexOf(s.sentence);

        if (idx !== -1) {
          if (idx > 0) {
            const preText = remaining.slice(0, idx);
            elements.push(
              <span key={`${pIdx}-pre-${keyCounter++}`} className="text-zinc-800">
                {renderHighlightedText(preText, article.words)}
              </span>
            );
          }

          elements.push(
            <SentenceBlock
              key={`${pIdx}-s-${sentencePtr}`}
              text={s.sentence}
              analysis={s}
              isSelected={selectedSentence?.sentence === s.sentence}
              onSelect={() => {
                setSelectedSentence(
                  selectedSentence?.sentence === s.sentence ? null : s
                );
                setPanelOpen(true);
                if (id) recordSentenceClick(id);
              }}
              words={article.words}
              showTranslation={bilingualMode}
            />
          );

          remaining = remaining.slice(idx + s.sentence.length);
          sentencePtr++;
        } else {
          break;
        }
      }

      if (remaining) {
        elements.push(
          <span key={`${pIdx}-rest`} className="text-zinc-800">
            {renderHighlightedText(remaining, article.words)}
          </span>
        );
      }

      return (
        <p key={pIdx} className="mb-4 leading-8 text-lg">
          {elements}
        </p>
      );
    });
  }, [article, selectedSentence, bilingualMode]);

  if (!article) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center text-zinc-500">
        加载中...
      </main>
    );
  }

  const grade = getGradeById(article.difficulty.gradeId);
  const difficultyLabel = grade
    ? `${LEVEL_LABELS[grade.level]}${grade.name} · ${grade.cefr}`
    : "未知难度";

  const hasSentenceAnalysis =
    article.sentences && article.sentences.length > 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          {regenerating ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-1 h-4 w-4" />
          )}
          重新生成
        </Button>
      </div>

      <Card className="overflow-hidden border-zinc-200 shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-2 text-sm text-zinc-500">
            {new Date(article.createdAt).toLocaleString("zh-CN")}
          </div>
          <h1 className="mb-4 text-2xl font-bold text-zinc-900 sm:text-3xl">
            {article.title}
          </h1>

          <div className="mb-2 relative">
            <div className={`flex flex-wrap items-center gap-2 ${tagsExpanded ? "" : "max-h-[4.5rem] overflow-hidden"}`}>
              {article.grammar.map((g) => (
                <Badge key={g.id} variant="secondary" className="text-xs">
                  {g.name}
                </Badge>
              ))}
              {article.theme && article.theme !== "none" && (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                  {THEME_LABELS[article.theme]}
                </Badge>
              )}
              {article.style && article.style !== "none" && article.style !== "natural" && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                  {STYLE_LABELS[article.style]}
                </Badge>
              )}
              {article.words.map((w, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className={`cursor-pointer text-xs ${
                    highlightedWord === w.word.toLowerCase()
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : ""
                  }`}
                  onClick={() => setHighlightedWord(w.word.toLowerCase())}
                >
                  {w.word}
                </Badge>
              ))}
            </div>
            {!tagsExpanded && (
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>
          <div className="mb-6 flex justify-end">
            <button
              type="button"
              onClick={() => setTagsExpanded(!tagsExpanded)}
              className="flex items-center gap-0.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              {tagsExpanded ? (
                <>收起 <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>展开标签 <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          </div>

          <Separator className="mb-6" />

          {/* 双语对照开关 */}
          {hasSentenceAnalysis && (
            <div className="mb-3 flex items-center justify-between">
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <BookOpen className="mb-0.5 mr-1 inline-block h-3.5 w-3.5" />
                点击文章中的句子，查看结构分析、难词解释和语法说明
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs gap-1 ${bilingualMode ? "text-blue-700 bg-blue-50" : "text-zinc-500"}`}
                onClick={() => setBilingualMode(!bilingualMode)}
              >
                <Languages className="h-3.5 w-3.5" />
                {bilingualMode ? "关闭对照" : "双语对照"}
              </Button>
            </div>
          )}

          {/* 文章内容 */}
          <div className="leading-relaxed">{contentNodes}</div>

          <Separator className="my-6" />

          <div className="rounded-lg bg-zinc-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">中文大意</h3>
            <p className="text-zinc-700">{article.translation}</p>
          </div>

          <Separator className="my-6" />

          {/* 学习报告 */}
          <ArticleLearningReport article={article} />

          {/* 课后测验 */}
          <QuizPanel article={article} />
        </CardContent>
      </Card>

      {/* 句子分析面板 */}
      {selectedSentence && panelOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-2xl px-4 py-4">
            {/* 面板头部 */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-zinc-900">句子解析</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPanelOpen(false)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setSelectedSentence(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 原句 + 逐句翻译 */}
            <div className="mb-3 rounded-md bg-zinc-50 px-3 py-2">
              <p className="text-sm font-medium text-zinc-800">
                {selectedSentence.sentence}
              </p>
              {selectedSentence.translation && (
                <p className="mt-1 text-sm text-zinc-500">
                  {selectedSentence.translation}
                </p>
              )}
            </div>

            {/* 句子成分标注 */}
            {selectedSentence.constituents && selectedSentence.constituents.length > 0 && (
              <div className="mb-3">
                <h4 className="mb-1.5 text-xs font-semibold text-blue-700">
                  句子成分
                </h4>
                <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm leading-relaxed">
                  {renderAnnotatedSentence(selectedSentence.sentence, selectedSentence.constituents)}
                </div>
              </div>
            )}

            {/* 分析内容 */}
            <div className="space-y-3">
              {/* 难词解释 */}
              {selectedSentence.difficultWords &&
                selectedSentence.difficultWords.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold text-blue-700">
                      难词
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedSentence.difficultWords.map((dw, idx) => (
                        <div
                          key={idx}
                          className="rounded-md bg-amber-50 px-3 py-2 text-sm"
                        >
                          {/* 第一行：原词 + 音标 */}
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-amber-900">
                              {dw.originalForm || dw.word}
                            </span>
                            {dw.phonetic && (
                              <span className="text-xs text-zinc-500 font-mono">
                                {dw.phonetic}
                              </span>
                            )}
                          </div>
                          {/* 第二行：词性 + 释义 */}
                          <div className="flex items-center gap-1.5">
                            {dw.partOfSpeech && (
                              <span className="text-xs text-amber-700">
                                {dw.partOfSpeech}
                              </span>
                            )}
                            <span className="text-zinc-700">
                              {dw.meaning}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 短语 */}
              {selectedSentence.phrases &&
                selectedSentence.phrases.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-blue-700">
                      短语
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedSentence.phrases.map((p, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2"
                        >
                          <code className="block text-sm font-semibold text-emerald-800">
                            {p.phrase}
                          </code>
                          <span className="text-xs text-emerald-700">
                            {p.meaning}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 语法 */}
              {selectedSentence.grammars &&
                selectedSentence.grammars.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-blue-700">
                      语法
                    </h4>
                    <div className="space-y-2">
                      {selectedSentence.grammars.map((g, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-blue-100 bg-blue-50/50 p-3"
                        >
                          <span className="text-sm font-semibold text-blue-800">
                            {g.name}
                          </span>
                          <p className="mt-0.5 text-sm text-zinc-700">
                            {g.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* 收起状态的面板（只显示一个提示条） */}
      {selectedSentence && !panelOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 cursor-pointer border-t bg-white py-2 shadow-sm"
          onClick={() => setPanelOpen(true)}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-4 text-sm text-blue-600">
            <BookOpen className="h-4 w-4" />
            <span>已选中句子，点击展开解析</span>
            <ChevronUp className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* 单词点击提示 + 掌握度标记 */}
      {highlightedWord && (
        <WordProficiencyPopup
          word={highlightedWord}
          articleWords={article?.words || []}
          wordUsages={article?.wordUsages}
          onClose={() => setHighlightedWord(null)}
        />
      )}
    </main>
  );
}

export default function ArticlePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center text-zinc-500">
          加载中...
        </main>
      }
    >
      <ArticleViewer />
    </Suspense>
  );
}
