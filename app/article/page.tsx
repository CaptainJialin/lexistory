"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSentencePlayer } from "@/lib/use-sentence-player";
import { getReadingProgress, saveReadingProgress } from "@/lib/reading-progress";
import { notifyDataChanged, useStoreVersion } from "@/lib/client-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Article, SentenceAnalysis, PROFICIENCY_LABELS, THEME_LABELS, STYLE_LABELS, type WordItem } from "@/lib/types";
import { getArticles, recordSentenceClick } from "@/lib/storage";
import { readableSentences } from "@/lib/reader-sentences";
import { analyzeArticle } from "@/lib/analyze-article";
import { withLearningTransaction } from "@/lib/learning-transaction";
import { getWordBook, updateWordProficiency, addWords } from "@/lib/wordbook";
import { findHighlights, coverageRate, computeCoverage, longSentencesIn } from "@/lib/coverage";
import { getArticleStudyLabel, resolveArticleGrade } from "@/lib/grade-resolver";
import { registerArticleLearning } from "@/lib/learning";
import { regenerateArticle } from "@/lib/generate-article";
import { QuizPanel } from "@/components/article/quiz-panel";
import { SentenceAnalysisPanel } from "@/components/article/sentence-analysis-panel";
import { ArrowLeft, RotateCcw, BookOpen, ChevronDown, ChevronUp, Loader2, Sparkles, Target, CheckCircle2, RotateCcw as RefreshCw, Languages, AlertTriangle } from "lucide-react";

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
        role={onWordClick ? "button" : undefined}
        tabIndex={onWordClick ? 0 : undefined}
        onKeyDown={onWordClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onWordClick(match.wordKey); } } : undefined}
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
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(); } }}
          onClick={onSelect}
          className={`cursor-pointer rounded px-0.5 transition-colors ${
            isSelected
              ? "bg-teal-100 text-teal-900"
              : analysis
              ? "hover:bg-teal-50"
              : ""
          } ${isSpeaking ? "ring-1 ring-teal-300" : ""}`}
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
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(); } }}
      onClick={onSelect}
      className={`cursor-pointer rounded px-0.5 transition-colors ${
        isSelected
          ? "bg-teal-100 text-teal-900"
          : analysis
          ? "hover:bg-teal-50"
          : ""
      } ${isSpeaking ? "ring-1 ring-teal-300" : ""}`}
      title={analysis ? "点击查看句子解析" : undefined}
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
    <div className="fixed bottom-24 left-1/2 z-40 w-[90%] max-w-md -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg lg:bottom-6">
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
        <div className="mt-3"><Button variant="outline" size="sm" onClick={() => {
          addWords([{ word, meaning: wordItem?.targetMeaning || wordItem?.meaning || wordUsages?.[word.toLowerCase()], phrases: wordItem?.phrases }]);
          setEntry(getWordBook().find((item) => item.word.toLowerCase() === word.toLowerCase()) ?? null);
          notifyDataChanged();
        }}>加入单词本</Button><p className="mt-2 text-xs text-zinc-400">也可以在读完后，一次收下本文的目标词。</p></div>
      )}
    </div>
  );
}

// ====== 测验面板 ======
function ArticleLearningReport({
  article,
  onRegenerate,
}: {
  article: Article;
  onRegenerate?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const storeVersion = useStoreVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const book = useMemo(() => getWordBook(), [storeVersion]);

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
  const sentences = useMemo(() => article ? readableSentences(article) : [], [article]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const analysisRef = useRef<AbortController | null>(null);
  const generationRef = useRef<AbortController | null>(null);
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<SentenceAnalysis | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [bilingualMode, setBilingualMode] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  /** 长难句逐句跳转的游标，-1 表示还没开始 */
  const [longIndex, setLongIndex] = useState(-1);
  const { player, state: playback, setRate } = useSentencePlayer();
  const speakingSentence = playback.status === "playing" ? playback.text : null;
  const [completed, setCompleted] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { player.stop(); setSelectedSentence(null); setHighlightedWord(null); }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [player]);

  function handleComplete() {
    if (!article) return false;
    if (completed) return true;
    try {
      withLearningTransaction(() => {
        registerArticleLearning(article);
        saveReadingProgress(article.id, { completedAt: Date.now() });
      });
      setCompleted(true);
      setActionError("");
      notifyDataChanged();
      return true;
    } catch {
      setActionError("学习记录未能保存，可能是设备空间不足。请先到学习报告导出备份，再重试。");
      return false;
    }
  }

  async function handleRegenerate() {
    if (!article || generationRef.current) return;
    const grade = resolveArticleGrade(article);
    if (!grade) return;
    setRegenerating(true);
    setActionError("");
    player.stop();
    const controller = new AbortController();
    generationRef.current = controller;
    try {
      const newArticle = await regenerateArticle(article, grade, controller.signal);
      controller.signal.throwIfAborted();
      router.push(`/article?id=${newArticle.id}`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setActionError(error instanceof Error ? error.message : "生成失败，请检查网络后重试。");
      setRegenerating(false);
    } finally {
      if (generationRef.current === controller) generationRef.current = null;
    }
  }

  const runAnalysis = useCallback(async (source: Article, controller: AbortController) => {
    setAnalyzing(true); setAnalysisError("");
    try {
      const updated = await analyzeArticle(source, controller.signal);
      if (controller.signal.aborted || analysisRef.current !== controller) return;
      setArticle(updated);
      notifyDataChanged();
    } catch (error) {
      if (!controller.signal.aborted && analysisRef.current === controller) setAnalysisError(error instanceof Error ? error.message : "解析失败，请重试。");
    } finally {
      if (analysisRef.current === controller && !controller.signal.aborted) setAnalyzing(false);
    }
  }, []);

  function handleAnalyze() {
    if (!article || analyzing) return;
    analysisRef.current?.abort();
    const controller = new AbortController();
    analysisRef.current = controller;
    void runAnalysis(article, controller);
  }

  function pauseAnalysis() {
    analysisRef.current?.abort();
    setAnalyzing(false);
    setAnalysisError("解析已暂停，正文已经保存。需要时可继续补全。");
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
    player.stop();
    setSelectedSentence(null);
    setHighlightedWord(null);
    setLongIndex(-1);
    setCompleted(Boolean(getReadingProgress(found.id)?.completedAt));
    setActionError(""); setAnalysisError(""); setAnalyzing(false);
    try { saveReadingProgress(found.id, {}); } catch { /* Reading works without storage. */ }
    const controller = new AbortController();
    analysisRef.current = controller;
    if (found.analysisStatus === "pending") void runAnalysis(found, controller);
    return () => { controller.abort(); analysisRef.current?.abort(); generationRef.current?.abort(); generationRef.current = null; player.stop(); };
  }, [id, router, player, runAnalysis]);

  // 把 content 渲染为带交互句子的段落
  /**
   * 逐句跳转长难句：每点一次选中下一个，到底后回到第一个。
   * 选中即打开底部解析面板，用户能直接看到成分拆解。
   */
  /** 选中第 n 句（用于面板里的上一句/下一句） */
  const selectSentenceAt = useCallback(
    (n: number) => {
      const list = sentences;
      if (n < 0 || n >= list.length) return;
      player.stop();
      setSelectedSentence(list[n]);
      if (article) { try { saveReadingProgress(article.id, { sentenceIndex: n }); } catch { /* Optional bookmark. */ } }
      setPanelOpen(true);
      // 跳到别的句子后，长难句游标就不再对应了
      setLongIndex(-1);
    },
    [article, player, sentences]
  );

  const handleNextLongSentence = useCallback(() => {
    const longs = longSentencesIn(article!);
    if (longs.length === 0) return;
    const next = (longIndex + 1) % longs.length;
    const target = sentences.find((s) => s.sentence === longs[next]);
    setLongIndex(next);
    if (target) {
      player.stop();
      setSelectedSentence(target);
      setPanelOpen(true);
    }
  }, [article, longIndex, player, sentences]);

  const contentNodes = useMemo(() => {
    if (!article) return null;

    const paragraphs = article.content.split("\n\n").filter((p) => p.trim());
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
                player.stop();
                setSelectedSentence(
                  selectedSentence?.sentence === s.sentence ? null : s
                );
                setPanelOpen(true);
                try { saveReadingProgress(article.id, { sentenceIndex: sentences.indexOf(s) }); } catch { /* Optional bookmark. */ }
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
  }, [article, selectedSentence, bilingualMode, id, player, speakingSentence, sentences]);

  if (!article) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center text-zinc-500">
        加载中...
      </main>
    );
  }

  const difficultyLabel = getArticleStudyLabel(article);

  const hasSentenceAnalysis =
    sentences.length > 0;

  // 长难句是考研阅读最大的失分点，标出来并支持逐句跳转
  const longSentences = longSentencesIn(article);

  const selectedIndex = selectedSentence
    ? sentences.findIndex(
        (s) => s.sentence === selectedSentence.sentence
      )
    : -1;

  return (
    <main
      className={
        // 桌面端解析面板停在右侧，正文让出宽度，两边能同时看见——
        // 攻克长难句时需要对照它在原文里的位置
        "mx-auto w-full max-w-2xl flex-1 px-4 py-6 transition-[padding] duration-200 " +
        (selectedSentence && panelOpen ? "lg:mr-[400px] lg:w-[calc(100%_-_400px)]" : "")
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
      {regenerating && <div role="status" className="mb-4 rounded-xl bg-teal-50 p-3 text-sm text-primary">正在准备另一篇文章，这篇仍然保留。<Button size="sm" variant="ghost" onClick={() => { generationRef.current?.abort(); generationRef.current = null; setRegenerating(false); }}>取消生成</Button></div>}

      {actionError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
      {getReadingProgress(article.id)?.sentenceIndex !== undefined && !selectedSentence && (
        <Button variant="outline" className="mb-4" onClick={() => selectSentenceAt(getReadingProgress(article.id)!.sentenceIndex!)}>接着看上次的句子</Button>
      )}
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
                    : "点词看释义 · 点句子看解析 · 点播放听朗读"}
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

          {/* 文章内容 */}
          {sentences.some((sentence) => !sentence.translation) && <div role="status" className="mb-4 rounded-xl border border-teal-200/70 bg-teal-50/70 p-3 text-xs leading-6 text-primary"><div className="flex items-start gap-2">{analyzing && <Loader2 className="mt-1 size-4 shrink-0 animate-spin" />}<span>{analyzing ? "正文已保存，可以先读。逐句解析正在补齐，不会自动播放语音。" : analysisError || "部分句子的解析还未准备好，正文和朗读已可使用。"}</span></div><div className="mt-1 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-zinc-500">已就绪 {sentences.filter((sentence) => sentence.translation).length} / {sentences.length} 句</span><Button variant="ghost" size="sm" onClick={analyzing ? pauseAnalysis : handleAnalyze} className="text-xs">{analyzing ? "先暂停解析" : "补全句子解析"}</Button></div></div>}
          <div className="reader-prose">{contentNodes}</div>

          <section className="my-7 rounded-2xl border border-teal-200 bg-teal-50/70 p-5" aria-label="完成阅读">
            <p className="font-semibold text-teal-950">{completed ? "这一篇，已经成为你的积累。" : "读到这里，为今天留下一点积累。"}</p>
            <p className="mt-2 text-sm leading-6 text-teal-800">{completed ? "阅读已保存。可以做下方测验检验理解，或去复习刚遇见的单词。" : "确认读完后，本文实际出现的目标词会加入单词本，并记入今日阅读。"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handleComplete} disabled={completed}><CheckCircle2 className="mr-2 size-4" />{completed ? "已完成阅读" : "我读完了"}</Button>
              {completed && <Link href="/review" className="inline-flex min-h-10 items-center rounded-lg border border-teal-200 bg-white px-4 text-sm font-medium text-teal-800">复习刚学的词 →</Link>}
              {article.isDemo && <Link href="/onboarding" className="inline-flex min-h-10 items-center px-3 text-sm text-teal-800">定制我的学习起点 →</Link>}
            </div>
          </section>

          <Separator className="my-6" />

          <div className="rounded-lg bg-zinc-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">中文大意</h3>
            <p className="text-zinc-700">{article.translation}</p>
          </div>

          <Separator className="my-6" />

          {/* 学习报告 */}
          <ArticleLearningReport article={article} onRegenerate={handleRegenerate} />

          {/* 课后测验 */}
          <QuizPanel key={article.id} article={article} onComplete={handleComplete} />
        </CardContent>
      </Card>

      {/* 句子解析面板 */}
      {selectedSentence && panelOpen && (
        <SentenceAnalysisPanel
          analysis={sentences[selectedIndex] ?? selectedSentence}
          articleGrammars={article.grammar}
          index={selectedIndex}
          total={sentences.length}
          onPrev={() => selectSentenceAt(selectedIndex - 1)}
          onNext={() => selectSentenceAt(selectedIndex + 1)}
          playback={playback}
          onSpeak={() => void player.toggle(selectedSentence.sentence)}
          onReplay={() => void player.play(selectedSentence.sentence)}
          onRate={setRate}
          onCollapse={() => { player.pause(); setPanelOpen(false); }}
          onClose={() => { player.stop(); setSelectedSentence(null); }}
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
