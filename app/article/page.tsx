"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Article, SentenceAnalysis, PROFICIENCY_LABELS, THEME_LABELS, STYLE_LABELS, type WordItem, type QuizResult } from "@/lib/types";
import { getArticles, recordSentenceClick, saveQuizResult, recordUnitQuizOutcome } from "@/lib/storage";
import { getWordBook, updateWordProficiency } from "@/lib/wordbook";
import { findHighlights, coverageRate, computeCoverage, longSentencesIn } from "@/lib/coverage";
import { getArticleStudyLabel, resolveArticleGrade } from "@/lib/grade-resolver";
import { registerArticleLearning, applyQuizOutcome } from "@/lib/learning";
import { regenerateArticle } from "@/lib/generate-article";
import { prefetchNextLesson } from "@/lib/prefetch-next";
import { QUIZ_TYPE_LABELS, stripOptionPrefix } from "@/lib/ui-constants";
import { countClozeAvailable } from "@/lib/cloze";
import { SentenceAnalysisPanel } from "@/components/article/sentence-analysis-panel";
import { ArrowLeft, RotateCcw, BookOpen, ChevronDown, ChevronUp, Loader2, Sparkles, Target, CheckCircle2, XCircle, Trophy, RotateCcw as RefreshCw, Languages, AlertTriangle } from "lucide-react";

function renderHighlightedText(
  text: string,
  words: WordItem[],
  onWordClick?: (word: string) => void
): React.ReactNode[] {
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
        onClick={
          onWordClick
            ? (e) => {
                // 不要冒泡到句子——高亮词看上去就该点开释义，
                // 而不是选中整句并播放语音
                e.stopPropagation();
                onWordClick(match.wordKey);
              }
            : undefined
        }
        title={onWordClick ? `查看「${match.wordKey}」的释义` : undefined}
        className={
          (match.type === "phrase"
            ? "rounded-sm bg-amber-200 px-0.5 font-medium text-amber-900"
            : "rounded-sm bg-yellow-100 px-0.5 text-yellow-800") +
          (onWordClick ? " cursor-pointer hover:brightness-95" : "")
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
  isSpeaking,
  onSelect,
  onWordClick,
  words,
  showTranslation,
}: {
  text: string;
  analysis?: SentenceAnalysis;
  isSelected: boolean;
  isSpeaking: boolean;
  onSelect: () => void;
  onWordClick?: (word: string) => void;
  words: WordItem[];
  showTranslation?: boolean;
}) {
  const highlighted = useMemo(
    () => renderHighlightedText(text, words, onWordClick),
    [text, words, onWordClick]
  );

  if (showTranslation && analysis?.translation) {
    return (
      <span className="inline-block align-top">
        <span
          onClick={onSelect}
          className={`cursor-pointer rounded px-0.5 transition-colors ${
            isSelected
              ? "bg-teal-100 text-teal-900"
              : analysis
              ? "hover:bg-teal-50"
              : ""
          } ${isSpeaking ? "ring-1 ring-teal-300" : ""}`}
          title={analysis ? "点击查看句子解析并播放语音" : undefined}
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
          ? "bg-teal-100 text-teal-900"
          : analysis
          ? "hover:bg-teal-50"
          : ""
      } ${isSpeaking ? "ring-1 ring-teal-300" : ""}`}
      title={analysis ? "点击查看句子解析并播放语音" : undefined}
    >
      {highlighted}
    </span>
  );
}

const PROFICIENCY_COLORS = [
  "bg-red-50 text-red-700 border-red-200",
  "bg-orange-50 text-orange-700 border-orange-200",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-green-50 text-green-700 border-green-200",
];

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
  const [entry, setEntry] = useState<ReturnType<typeof getWordBook>[number] | null>(() => {
    const book = getWordBook();
    const found = book.find((e) => e.word.toLowerCase() === word.toLowerCase());
    return found || null;
  });

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

      {(wordItem?.targetMeaning || wordItem?.meaning) && (
        <div className="mt-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          <span className="font-medium">目标义项：</span>
          {wordItem.targetMeaning || wordItem.meaning}
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

      {wordItem?.usagePatterns && wordItem.usagePatterns.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {wordItem.usagePatterns.map((pattern, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">
              {pattern}
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
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [finalResult, setFinalResult] = useState<QuizResult | null>(null);
  /** 交卷后才查，此时刚读过的词已经入册，数字才准 */
  const [clozeReady, setClozeReady] = useState(0);

  const quiz = article.quiz;
  if (!quiz || quiz.length === 0) return null;

  const quizItems = quiz;
  const currentQ = quizItems[currentIdx];
  const total = quizItems.length;
  const correctCount = answers.filter(
    (a, i) => a === quizItems[i].correctIndex
  ).length;

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
      const finalAnswers = answers.slice(0, total);
      const finalCorrectCount = finalAnswers.filter(
        (a, i) => a === quizItems[i].correctIndex
      ).length;
      const score = Math.round((finalCorrectCount / total) * 100);
      const unitId = article.source?.unitId ?? "";
      const passed = score >= 80;
      setFinished(true);
      // 保存测验结果
      const result: QuizResult = {
        unitId,
        articleId: article.id,
        score,
        totalQuestions: total,
        correctCount: finalCorrectCount,
        wrongQuestions: finalAnswers
          .map((a, i) =>
            a !== quizItems[i].correctIndex ? quizItems[i].id : null
          )
          .filter(Boolean) as string[],
        completedAt: Date.now(),
      };
      saveQuizResult(result);
      setFinalResult(result);
      if (unitId) {
        recordUnitQuizOutcome(unitId, result, passed);
      }

      // 按每道题的对错分别推进相关词和语法的 SRS：
      // 答对的间隔拉长，答错的当天重来并会被排到下一篇文章的队首。
      applyQuizOutcome(article, finalAnswers, result);
      // 判分会改 SRS，之后再查可练数量才准
      setClozeReady(countClozeAvailable().total);
    }
  }

  function handleRestart() {
    setStarted(false);
    setCurrentIdx(0);
    setSelectedOption(null);
    setShowAnswer(false);
    setAnswers([]);
    setFinished(false);
    setFinalResult(null);
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
    const displayCorrect = finalResult?.correctCount ?? correctCount;
    const displayScore = finalResult?.score ?? Math.round((correctCount / total) * 100);
    const passed = displayScore >= 80;
    return (
      <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
            <Trophy className="h-7 w-7 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">
            {passed ? "本单元已完成" : "本单元待巩固"}
          </h3>
          <p className="mt-1 text-3xl font-bold text-indigo-600">
            {displayCorrect}/{total}
          </p>
          <p className="text-sm text-zinc-500">
            {passed
              ? "答错的词会自动排进下一篇文章。"
              : "建议再练一次，错题会留在复习状态里。"}
          </p>
          {/*
            刚做完测验是成就感最高的一刻，直接给出下一步动作，
            而不是把人丢回首页自己在一堆卡片里找。
          */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={handleRestart} variant="outline" className="gap-1">
              <RefreshCw className="h-4 w-4" />
              再测一次
            </Button>
            {clozeReady > 0 ? (
              <Button onClick={() => router.push("/review")} className="gap-1">
                <Target className="h-4 w-4" />
                练一练学过的词（{clozeReady}）
              </Button>
            ) : (
              <Button onClick={() => router.push("/")} className="gap-1">
                <Target className="h-4 w-4" />
                回首页
              </Button>
            )}
          </div>
          {clozeReady > 0 && (
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-3 text-xs text-zinc-400 hover:text-zinc-600"
            >
              回首页
            </button>
          )}
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
          {QUIZ_TYPE_LABELS[currentQ.type] ?? "阅读理解"}
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
                <span>{stripOptionPrefix(opt)}</span>
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

function ArticleLearningReport({
  article,
  onRegenerate,
}: {
  article: Article;
  onRegenerate?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const book = useMemo(() => getWordBook(), []);

  // 出现次数直接读生成时算好的 coverage，和文章里的高亮是同一套判定
  const coverage = useMemo(
    () => article.coverage ?? computeCoverage(article),
    [article]
  );

  const wordStats = useMemo(() => {
    return article.words.map((w) => {
      const lower = w.word.toLowerCase();
      const entry = book.find((e) => e.word.toLowerCase() === lower);
      return {
        word: w.word,
        count: coverage.words[lower] ?? 0,
        role: article.wordRoles?.[lower],
        proficiency: entry?.srs?.proficiency ?? entry?.proficiency ?? 0,
        meaning: w.meaning || entry?.meaning,
      };
    });
  }, [article, book, coverage]);

  const needReview = wordStats.filter((w) => w.proficiency < 3);
  const missing = wordStats.filter((w) => w.count === 0);
  const rate = coverageRate(coverage);

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
          <p
            className={`text-lg font-bold ${
              rate.words === 100 ? "text-green-600" : "text-amber-600"
            }`}
          >
            {rate.words}%
          </p>
          <p className="text-[10px] text-zinc-500">实际复现率</p>
        </div>
        <div className="rounded-md bg-white p-2 text-center">
          <p className="text-lg font-bold text-zinc-900">{needReview.length}</p>
          <p className="text-[10px] text-zinc-500">需复习</p>
        </div>
      </div>

      {/* 模型漏用的词不会被计为「学过」，这里明说 */}
      {missing.length > 0 && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-100/60 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            {missing.length} 个目标词本篇未复现
          </p>
          <p className="mt-1 flex flex-wrap gap-1">
            {missing.map((w) => (
              <span key={w.word} className="text-xs text-amber-800">
                {w.word}
              </span>
            ))}
          </p>
          <p className="mt-1 text-[10px] text-amber-700">
            这些词不计入学习记录，会保留在复习队列里。
          </p>
          {onRegenerate && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 gap-1 border-amber-400 text-xs text-amber-800 hover:bg-amber-50"
              onClick={onRegenerate}
            >
              <RefreshCw className="h-3 w-3" />
              重新生成一篇
            </Button>
          )}
        </div>
      )}

      <div className="mb-3 space-y-1">
        {wordStats.map((w) => (
          <div
            key={w.word}
            className="flex items-center justify-between rounded-md bg-white px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-sm font-medium text-zinc-900">{w.word}</span>
              {w.role && (
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${
                    w.role === "new"
                      ? "border-teal-200 bg-teal-50 text-teal-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {w.role === "new" ? "新学" : "复现"}
                </Badge>
              )}
              {w.meaning && (
                <span className="truncate text-xs text-zinc-400">{w.meaning}</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`text-xs ${
                  w.count === 0 ? "text-amber-600" : "text-zinc-400"
                }`}
              >
                {w.count === 0 ? "未出现" : `出现 ${w.count} 次`}
              </span>
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
          去首页生成下一篇（这些词会自动复现）
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
  /** 长难句逐句跳转的游标，-1 表示还没开始 */
  const [longIndex, setLongIndex] = useState(-1);
  const [speakingSentence, setSpeakingSentence] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlCacheRef = useRef<Map<string, string>>(new Map());

  const speakWithBrowser = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setSpeechError("当前浏览器不支持句子朗读。");
      setSpeakingSentence(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.onend = () => setSpeakingSentence(null);
    utterance.onerror = () => {
      setSpeechError("句子朗读失败，请再试一次。");
      setSpeakingSentence(null);
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const playSentenceAudio = useCallback(
    async (text: string) => {
      const sentence = text.trim();
      if (!sentence) return;

      audioRef.current?.pause();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeechError("");
      setSpeakingSentence(sentence);

      try {
        let audioUrl = audioUrlCacheRef.current.get(sentence);
        if (!audioUrl) {
          const res = await fetch("/api/speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: sentence }),
          });

          if (!res.ok) {
            throw new Error("Speech API unavailable");
          }

          const blob = await res.blob();
          audioUrl = URL.createObjectURL(blob);
          audioUrlCacheRef.current.set(sentence, audioUrl);
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => setSpeakingSentence(null);
        audio.onerror = () => {
          setSpeechError("模型语音播放失败，已尝试浏览器朗读。");
          speakWithBrowser(sentence);
        };
        await audio.play();
      } catch {
        speakWithBrowser(sentence);
      }
    },
    [speakWithBrowser]
  );

  useEffect(() => {
    const audioUrlCache = audioUrlCacheRef.current;
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      audioUrlCache.forEach((url) => URL.revokeObjectURL(url));
      audioUrlCache.clear();
    };
  }, []);

  async function handleRegenerate() {
    if (!article) return;
    const grade = resolveArticleGrade(article);
    if (!grade) return;
    setRegenerating(true);
    try {
      const newArticle = await regenerateArticle(article, grade);
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
    if (!found) {
      router.push("/");
      return;
    }

    setArticle(found);
    setRegenerating(false); // 新文章加载完成，重置 loading 状态

    // 停留够久才算真的读了。入册只针对 coverage 验证过真的出现在正文里的
    // 词和语法——模型漏用的目标词不会被记成「学过了」。
    const timer = setTimeout(() => {
      registerArticleLearning(found);
      // 入册之后再预生成，下一篇才能反映刚学到的词
      prefetchNextLesson();
    }, 3000);
    return () => clearTimeout(timer);
  }, [id, router]);

  // 把 content 渲染为带交互句子的段落
  /**
   * 逐句跳转长难句：每点一次选中下一个，到底后回到第一个。
   * 选中即打开底部解析面板，用户能直接看到成分拆解。
   */
  /** 选中第 n 句（用于面板里的上一句/下一句） */
  const selectSentenceAt = useCallback(
    (n: number) => {
      const list = article?.sentences ?? [];
      if (n < 0 || n >= list.length) return;
      setSelectedSentence(list[n]);
      setPanelOpen(true);
      // 跳到别的句子后，长难句游标就不再对应了
      setLongIndex(-1);
    },
    [article]
  );

  const handleNextLongSentence = useCallback(() => {
    const longs = longSentencesIn(article!);
    if (longs.length === 0) return;
    const next = (longIndex + 1) % longs.length;
    const target = article!.sentences?.find((s) => s.sentence === longs[next]);
    setLongIndex(next);
    if (target) {
      setSelectedSentence(target);
      setPanelOpen(true);
    }
  }, [article, longIndex]);

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
              isSpeaking={speakingSentence === s.sentence}
              onSelect={() => {
                setSelectedSentence(
                  selectedSentence?.sentence === s.sentence ? null : s
                );
                setPanelOpen(true);
                playSentenceAudio(s.sentence);
                if (id) recordSentenceClick(id);
              }}
              onWordClick={setHighlightedWord}
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
  }, [article, selectedSentence, bilingualMode, id, playSentenceAudio, speakingSentence]);

  if (!article) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center text-zinc-500">
        加载中...
      </main>
    );
  }

  const difficultyLabel = getArticleStudyLabel(article);

  const hasSentenceAnalysis =
    article.sentences && article.sentences.length > 0;

  // 长难句是考研阅读最大的失分点，标出来并支持逐句跳转
  const longSentences = longSentencesIn(article);

  const selectedIndex = selectedSentence
    ? (article.sentences ?? []).findIndex(
        (s) => s.sentence === selectedSentence.sentence
      )
    : -1;

  return (
    <main
      className={
        // 桌面端解析面板停在右侧，正文让出宽度，两边能同时看见——
        // 攻克长难句时需要对照它在原文里的位置
        "mx-auto w-full max-w-2xl flex-1 px-4 py-6 transition-[padding] duration-200 " +
        (selectedSentence && panelOpen ? "lg:mr-[400px]" : "")
      }
    >
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

      <Card className="overflow-hidden rounded-[22px] border-zinc-200 bg-[#fffefa] shadow-sm">
        <CardContent className="p-5 sm:p-8">
          <p className="page-eyebrow mb-5 flex items-center gap-2"><BookOpen className="size-3.5 text-teal-500" />YOUR READING MOMENT</p>
          <div className="mb-2 text-sm text-zinc-500">
            {new Date(article.createdAt).toLocaleString("zh-CN")}
          </div>
          <h1 className="mb-5 font-reading text-[30px] leading-tight tracking-tight text-zinc-900 sm:text-[38px]">
            {article.title}
          </h1>

          <div className="mb-2 relative">
            <div className={`flex flex-wrap items-center gap-2 ${tagsExpanded ? "" : "max-h-[4.5rem] overflow-hidden"}`}>
              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
                {difficultyLabel}
              </Badge>
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700">
                  <BookOpen className="mb-0.5 mr-1 inline-block h-3.5 w-3.5" />
                  {speakingSentence
                    ? "正在播放句子语音..."
                    : "点高亮词看释义，点句子其他位置看解析并朗读"}
                </div>
                {/*
                  长难句是考研阅读最大的失分点，只显示个数字没用——
                  做成可点击，逐句跳过去看拆解。
                */}
                {longSentences.length > 0 && (
                  <button
                    type="button"
                    onClick={handleNextLongSentence}
                    className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700 transition-colors hover:bg-purple-100"
                    title="逐句查看长难句拆解"
                  >
                    长难句 {longIndex >= 0 ? `${longIndex + 1}/` : ""}
                    {longSentences.length}
                    <span className="ml-1 text-purple-400">
                      {longIndex >= 0 ? "· 看下一句" : "· 点击逐句攻克"}
                    </span>
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs gap-1 ${bilingualMode ? "text-teal-700 bg-teal-50" : "text-zinc-500"}`}
                onClick={() => setBilingualMode(!bilingualMode)}
              >
                <Languages className="h-3.5 w-3.5" />
                {bilingualMode ? "关闭对照" : "双语对照"}
              </Button>
            </div>
          )}
          {speechError && (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {speechError}
            </div>
          )}

          {/* 文章内容 */}
          <div className="reader-prose">{contentNodes}</div>

          <Separator className="my-6" />

          <div className="rounded-lg bg-zinc-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">中文大意</h3>
            <p className="text-zinc-700">{article.translation}</p>
          </div>

          <Separator className="my-6" />

          {/* 学习报告 */}
          <ArticleLearningReport article={article} onRegenerate={handleRegenerate} />

          {/* 课后测验 */}
          <QuizPanel article={article} />
        </CardContent>
      </Card>

      {/* 句子解析面板 */}
      {selectedSentence && panelOpen && (
        <SentenceAnalysisPanel
          analysis={selectedSentence}
          articleGrammars={article.grammar}
          index={selectedIndex}
          total={article.sentences?.length ?? 0}
          onPrev={() => selectSentenceAt(selectedIndex - 1)}
          onNext={() => selectSentenceAt(selectedIndex + 1)}
          onSpeak={() => playSentenceAudio(selectedSentence.sentence)}
          onCollapse={() => setPanelOpen(false)}
          onClose={() => setSelectedSentence(null)}
        />
      )}
      {/* 收起状态的面板（只显示一个提示条） */}
      {selectedSentence && !panelOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 cursor-pointer border-t bg-white py-2 shadow-sm"
          onClick={() => setPanelOpen(true)}
        >
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-4 text-sm text-teal-600">
            <BookOpen className="h-4 w-4" />
            <span>已选中句子，点击展开解析</span>
            <ChevronUp className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* 单词点击提示 + 掌握度标记 */}
      {highlightedWord && (
        <WordProficiencyPopup
          key={highlightedWord}
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
