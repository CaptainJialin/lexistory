"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LessonRecipe } from "@/components/lesson-recipe";
import { LearningCompanion } from "@/components/learning-companion";
import { ContinueReading } from "@/components/continue-reading";
import { apiFetch } from "@/lib/api-client";
import { notifyDataChanged } from "@/lib/client-store";
import { type WordItem, type UserProgress } from "@/lib/types";
import { getProgress, saveProgress, getLearningStats } from "@/lib/storage";
import { addWords, getWordBook } from "@/lib/wordbook";
import { countClozeAvailable } from "@/lib/cloze";
import { countTranslationAvailable } from "@/lib/translation-practice";
import {
  getDailyProgress,
  shouldRemindBackup,
  markBackupReminded,
  type DailyProgress,
} from "@/lib/daily-goal";
import { downloadBackup } from "@/lib/backup";
import {
  buildLessonPlan,
  findNextUnitAcrossGrades,
  wordsNeedingEnrichment,
  applyEnrichment,
  type LessonPlan,
  type EnrichedWord,
} from "@/lib/lesson-plan";
import { generateArticleFromPlan } from "@/lib/generate-article";
import {
  getPrefetched,
  isPrefetchValid,
  commitPrefetched,
  clearPrefetched,
  prefetchAsPlan,
  type PrefetchedLesson,
} from "@/lib/prefetch";
import {
  getAllBooks,
  getGradesByBook,
  getUnitsByGrade,
  getUnitById,
} from "@/lib/official-words";
import {
  Loader2, Sparkles, BookOpen, Target, Flame, Zap,
  ChevronRight, RotateCcw, Library, Plus, X, RefreshCw, Check,
  AlertTriangle, ArrowUpRight, Leaf,
} from "lucide-react";

const BOOK_LEVEL_LABELS: Record<string, string> = {
  primary: "小学",
  junior: "初中",
  senior: "高中",
  graduate: "考研",
};

type Mode = "task" | "select";

/**
 * 只显示实际完成到的阶段；正文就绪即打开阅读。
 */
const GENERATION_STEPS = [
  "正在编排词汇与语法...",
  "正在撰写文章...",
  "正在保存文章...",
];

export default function Home() {
  const router = useRouter();

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [mode, setMode] = useState<Mode>("task");
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // 教材选择
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  // 自定义词表
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");

  const [loading, setLoading] = useState(false);
  const generationRef = useRef<AbortController | null>(null);
  useEffect(() => () => generationRef.current?.abort(), []);

  function cancelGeneration() {
    generationRef.current?.abort();
    setLoading(false); setError("已取消。可以调整配方后重新生成。");
  }
  const [enriching, setEnriching] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState("");
  /** 上一次阅读时后台备好的下一篇，可秒开 */
  const [ready, setReady] = useState<PrefetchedLesson | null>(null);
  const [clozeCount, setClozeCount] = useState({ due: 0, total: 0 });
  const [translateCount, setTranslateCount] = useState(0);
  const [daily, setDaily] = useState<DailyProgress | null>(null);
  const [remindBackup, setRemindBackup] = useState(false);
  const [stats, setStats] = useState({
    totalArticles: 0,
    streakDays: 0,
    knownWords: 0,
    knownGrammars: 0,
    dueWords: 0,
    dueGrammars: 0,
  });

  const allBooks = useMemo(() => getAllBooks(), []);

  const availableGrades = useMemo(
    () => (selectedBookId ? getGradesByBook(selectedBookId) : []),
    [selectedBookId]
  );

  const availableUnits = useMemo(
    () =>
      selectedBookId && selectedGradeId
        ? getUnitsByGrade(selectedBookId, selectedGradeId)
        : [],
    [selectedBookId, selectedGradeId]
  );

  const currentUnit = useMemo(
    () =>
      progress
        ? getUnitById(progress.bookId, progress.gradeId, progress.unitId)
        : null,
    [progress]
  );

  const currentBook = useMemo(
    () => (progress ? allBooks.find((b) => b.id === progress.bookId) : null),
    [progress, allBooks]
  );

  const currentGrade = useMemo(
    () =>
      progress
        ? getGradesByBook(progress.bookId).find(
            (g) => g.gradeId === progress.gradeId
          )
        : null,
    [progress]
  );

  const currentUnitState = progress?.unitStates?.[progress.unitId];
  const nextUnit = progress ? findNextUnitAcrossGrades(progress) : null;
  const gradeUnits = progress
    ? getUnitsByGrade(progress.bookId, progress.gradeId)
    : [];
  const completedInGrade = progress
    ? gradeUnits.filter((u) => progress.completedUnits.includes(u.unitId)).length
    : 0;

  /** 解析粘贴的词表：逗号、换行、分号、空格都能分隔 */
  const customWords: WordItem[] = useMemo(() => {
    if (!customText.trim()) return [];
    return customText
      .split(/[,，;；\n\r\t]+/)
      .map((s) => s.trim())
      .filter((s) => s && /[a-zA-Z]/.test(s))
      .slice(0, 60)
      .map((word) => ({ word }));
  }, [customText]);

  /**
   * 已补全过的词义缓存。
   *
   * 配方每次重算都是从头 build，补全结果会被冲掉。没有这层缓存的话，
   * 用户每点掉一个词就会重新发一次补全请求——点 5 个词就是 5 次付费调用。
   */
  const enrichCacheRef = useRef<Map<string, EnrichedWord>>(new Map());

  const refreshPlan = useCallback(
    (p: UserProgress | null, custom: WordItem[], exclude: Set<string>) => {
      const built = buildLessonPlan({ progress: p, customWords: custom });
      if (exclude.size > 0) {
        built.words = built.words.filter(
          (s) => !exclude.has(s.item.word.toLowerCase())
        );
      }
      setPlan(applyEnrichment(built, [...enrichCacheRef.current.values()]));
    },
    []
  );

  useEffect(() => {
    let p = getProgress();
    // 全新用户先走摸底：直接甩三个下拉框既劝退，也让人看不出这产品到底特别在哪
    if (!p && getWordBook().length === 0) {
      router.replace("/onboarding");
      return;
    }
    // 进度指向的单元可能已经不存在了（教材数据更新、迁移遗漏等）。
    // 不兜底的话 currentUnit 为 null，今日任务整块渲染不出来，页面一片空白。
    if (p && !getUnitById(p.bookId, p.gradeId, p.unitId)) {
      const units = getUnitsByGrade(p.bookId, p.gradeId);
      if (units.length > 0) {
        p = { ...p, unitId: units[0].unitId };
        saveProgress(p);
      } else {
        p = null;
      }
    }

    setProgress(p);
    setStats(getLearningStats());
    setClozeCount(countClozeAvailable());
    setTranslateCount(countTranslationAvailable());
    setDaily(getDailyProgress());
    setRemindBackup(shouldRemindBackup());

    const prefetched = getPrefetched();
    if (isPrefetchValid(prefetched, p)) {
      setReady(prefetched);
    } else if (prefetched) {
      clearPrefetched(); // 进度变了或放太久，作废重算
    }

    if (!p) {
      setMode("select");
    } else {
      refreshPlan(p, [], new Set());
    }
  }, [refreshPlan, router]);

  // 粘贴词表变化时重算配方
  useEffect(() => {
    if (!progress) return;
    refreshPlan(progress, customWords, excluded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customWords, excluded, progress]);

  /**
   * 后台补全缺释义的词。
   *
   * 补全让模型按预期的义项来写（prompt 里的 <target meaning> / <usage patterns>），
   * 也让这些词进单词本时自带中文释义。刻意做成非阻塞的：没补完就点生成也没关系，
   * prompt 里已要求模型自行选一个适龄义项并在 wordUsages 里说明。
   */
  const pendingWords = plan ? wordsNeedingEnrichment(plan) : [];
  const enrichKey = pendingWords.join(",");
  const enrichGradeId = plan?.grade.id;

  useEffect(() => {
    if (!enrichKey || !enrichGradeId) return;

    const controller = new AbortController();
    setEnriching(true);

    apiFetch("/api/enrich-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: enrichKey.split(","), gradeId: enrichGradeId }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { words?: EnrichedWord[] } | null) => {
        if (!data?.words?.length) return;
        for (const word of data.words) {
          if (word?.word) {
            enrichCacheRef.current.set(word.word.trim().toLowerCase(), word);
          }
        }
        setPlan((current) =>
          current ? applyEnrichment(current, data.words!) : current
        );
      })
      .catch(() => {
        // 静默失败：补全只是锦上添花，不能挡住生成
      })
      .finally(() => setEnriching(false));

    return () => controller.abort();
  }, [enrichKey, enrichGradeId]);

  /**
   * 新一轮生成从准备阶段开始。
   */
  useEffect(() => {
    if (!loading) {
      setProgressStep(0);
      return;
    }
  }, [loading]);

  const handleToggleWord = useCallback((word: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      const key = word.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleConfirmSelection = useCallback(() => {
    if (!selectedBookId || !selectedGradeId || !selectedUnitId) return;
    const next: UserProgress = {
      bookId: selectedBookId,
      gradeId: selectedGradeId,
      unitId: selectedUnitId,
      completedUnits: progress?.completedUnits ?? [],
      unitStates: progress?.unitStates ?? {},
    };
    saveProgress(next);
    notifyDataChanged();
    setProgress(next);
    setExcluded(new Set());
    // 换了单元，之前备好的那篇就不对路了
    clearPrefetched();
    setReady(null);
    refreshPlan(next, customWords, new Set());
    setMode("task");
  }, [
    selectedBookId,
    selectedGradeId,
    selectedUnitId,
    progress,
    customWords,
    refreshPlan,
  ]);

  function handleNextUnit() {
    if (!progress || !nextUnit) return;
    const updated: UserProgress = {
      ...progress,
      gradeId: nextUnit.gradeId,
      unitId: nextUnit.unitId,
    };
    saveProgress(updated);
    notifyDataChanged();
    setProgress(updated);
    setExcluded(new Set());
    clearPrefetched();
    setReady(null);
    refreshPlan(updated, customWords, new Set());
  }

  /** 纯复习：整篇只用学过的词，让用户能主动消化积压 */
  async function handleReviewOnly() {
    if (!progress) return;
    setError("");
    setLoading(true);
    const controller = new AbortController(); generationRef.current = controller;
    try {
      const reviewPlan = buildLessonPlan({ progress, mode: "review" });
      if (reviewPlan.words.length === 0) {
        throw new Error("目前没有可复习的词");
      }
      const article = await generateArticleFromPlan(reviewPlan, { signal: controller.signal, onStage: (stage) => setProgressStep(stage === "writing" ? 1 : 2) });
      router.push(`/article?id=${article.id}`);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "生成失败，请重试");
      setLoading(false);
    }
  }

  /**
   * 用户自己改了配方（加词 / 去词）时，预生成的那篇就对不上了，
   * 这时必须走实时生成，不能把一篇不符合当前配方的文章塞给他。
   */
  const canUseReady =
    !!ready && customWords.length === 0 && excluded.size === 0;

  const displayPlan = canUseReady && ready ? prefetchAsPlan(ready) : plan;

  /** 秒开：文章早在上一次阅读时就备好了 */
  function handleOpenReady() {
    if (!ready) return;
    const article = commitPrefetched(ready);
    setReady(null);
    router.push(`/article?id=${article.id}`);
  }

  async function handleStartLearning() {
    if (!plan) return;
    setError("");
    setLoading(true);
    const controller = new AbortController(); generationRef.current = controller;
    try {
      // 超出本篇容量的自定义词先存进单词本，后续文章会自然带上
      const planned = new Set(plan.words.map((s) => s.item.word.toLowerCase()));
      const overflow = customWords.filter(
        (w) => !planned.has(w.word.toLowerCase())
      );
      if (overflow.length > 0) {
        addWords(overflow.map((w) => ({ word: w.word, source: "manual" })));
      }

      const article = await generateArticleFromPlan(plan, { signal: controller.signal, onStage: (stage) => setProgressStep(stage === "writing" ? 1 : 2) });
      router.push(`/article?id=${article.id}`);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "生成失败，请重试");
      setLoading(false);
    }
  }

  // ====== 今日任务 ======
  function renderTaskMode() {
    if (!progress || !currentUnit || !plan) return null;

    const completed = progress.completedUnits.includes(progress.unitId);
    const statusLabel = completed
      ? "已完成"
      : currentUnitState?.status === "review"
      ? "待巩固"
      : "进行中";
    const statusClass = completed
      ? "border-green-200 bg-green-50 text-green-700"
      : currentUnitState?.status === "review"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-teal-200 bg-teal-50 text-teal-700";

    return (
      <div className="space-y-5">
        <Card className="border-zinc-200 bg-white py-6">
          <CardHeader className="px-5 pb-1 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-teal-50"><BookOpen className="size-4 text-primary" /></span>
              <CardTitle className="text-base font-semibold">为你准备的下一篇</CardTitle>
              <span className="ml-auto text-[10px] tracking-wider text-zinc-400">YOUR NEXT STORY</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-5 sm:px-6">
            {/* 单元信息 */}
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-500">
                    {currentBook?.name} · {currentGrade?.gradeName}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900">
                    {currentUnit.unitName}
                  </p>
                  {gradeUnits.length > 0 && (
                    <p className="mt-1 text-xs text-zinc-500">
                      已完成 {completedInGrade}/{gradeUnits.length} 个单元
                      {plan.unitProgress && plan.unitProgress.total > 1 && (
                        <>
                          {" · "}本单元第 {plan.unitProgress.index}/
                          {plan.unitProgress.total} 篇
                        </>
                      )}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={`shrink-0 text-xs ${statusClass}`}>
                  {statusLabel}
                </Badge>
              </div>
              {currentUnitState && (
                <div className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  上次测验 {currentUnitState.lastScore} 分
                  {currentUnitState.status === "review"
                    ? "，建议再练一次。"
                    : "，可以继续下一步。"}
                </div>
              )}
            </div>

            {/* 配方 —— 生成前就让用户看到文章由什么组成 */}
            <LessonRecipe
              plan={displayPlan ?? plan}
              onToggleWord={canUseReady ? undefined : handleToggleWord}
              enriching={enriching && !canUseReady}
            />

            {excluded.size > 0 && (
              <button
                type="button"
                onClick={() => setExcluded(new Set())}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800"
              >
                <RotateCcw className="h-3 w-3" />
                已移除 {excluded.size} 个词，点此恢复
              </button>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {canUseReady ? (
              <>
                <Button
                  onClick={handleOpenReady}
                  className="w-full rounded-xl"
                  size="lg"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  开始阅读
                </Button>
                <p className="-mt-2 flex items-center justify-center gap-1 text-center text-xs text-emerald-600">
                  <Check className="h-3 w-3" />
                  已在你上次阅读时准备好，点开即读
                </p>
              </>
            ) : (
              <>
                <Button
                  onClick={handleStartLearning}
                  disabled={loading || plan.words.length === 0}
                  className="w-full rounded-xl"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {GENERATION_STEPS[progressStep]}
                    </>
                  ) : (
                    <>
                      <BookOpen className="mr-2 h-4 w-4" />
                      生成这篇文章
                      <ArrowUpRight className="ml-auto size-4" />
                    </>
                  )}
                </Button>
                {loading && (
                  <div className="-mt-2 text-center" role="status"><p className="text-xs text-zinc-500">正文准备好就打开，逐句解析会在阅读时补齐。</p><Button variant="ghost" size="sm" onClick={cancelGeneration} className="mt-1 text-xs">取消本次生成</Button></div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 自定义词表 */}
        <Card className="border-zinc-200">
          <CardContent className="p-4">
            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              aria-expanded={showCustom}
              aria-controls="custom-word-input"
              className="flex w-full items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 font-medium text-zinc-900">
                <Plus className="h-4 w-4 text-zinc-400" />
                加入自己的生词
              </span>
              {customWords.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {customWords.length} 词
                </Badge>
              )}
            </button>

            {showCustom && (
              <div className="mt-3 space-y-2">
                <Textarea
                  id="custom-word-input"
                  aria-label="自定义生词"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder={"粘贴或输入单词，逗号 / 换行分隔\n例如：resilient, advocate, nuance"}
                  rows={4}
                  className="text-sm"
                />
                <p className="text-xs text-zinc-400">
                  这些词会优先编进文章；超出本篇容量的会存入单词本，在后续文章中出现。
                </p>
                {customText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-zinc-500"
                    onClick={() => setCustomText("")}
                  >
                    <X className="h-3 w-3" />
                    清空
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1"
            onClick={() => {
              setSelectedBookId(progress.bookId);
              setSelectedGradeId(progress.gradeId);
              setSelectedUnitId(progress.unitId);
              setMode("select");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            切换单元
          </Button>
          {nextUnit && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1"
              onClick={handleNextUnit}
            >
              下一单元
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ====== 教材选择 ======
  function renderSelectMode() {
    return (
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Library className="h-5 w-5 text-amber-500" />
            选择学习进度
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="book-select" className="text-sm font-medium text-zinc-900">
              教材版本 <span className="text-red-500">*</span>
            </label>
            <Select
              value={selectedBookId}
              onValueChange={(v) => {
                setSelectedBookId(v || "");
                setSelectedGradeId("");
                setSelectedUnitId("");
              }}
            >
              <SelectTrigger id="book-select" className="w-full" >
                <SelectValue placeholder="请选择教材...">{allBooks.find((book) => book.id === selectedBookId)?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allBooks.map((book) => (
                  <SelectItem key={book.id} value={book.id}>
                    {book.name}（{BOOK_LEVEL_LABELS[book.level] ?? book.level}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBookId && (
            <div className="space-y-2">
              <label htmlFor="grade-select" className="text-sm font-medium text-zinc-900">
                年级 <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedGradeId}
                onValueChange={(v) => {
                  setSelectedGradeId(v || "");
                  setSelectedUnitId("");
                }}
              >
                <SelectTrigger id="grade-select" className="w-full">
                  <SelectValue placeholder="请选择年级...">{availableGrades.find((grade) => grade.gradeId === selectedGradeId)?.gradeName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableGrades.map((g) => (
                    <SelectItem key={g.gradeId} value={g.gradeId}>
                      {g.gradeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedGradeId && (
            <div className="space-y-2">
              <label htmlFor="unit-select" className="text-sm font-medium text-zinc-900">
                当前单元 <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedUnitId}
                onValueChange={(v) => setSelectedUnitId(v || "")}
              >
                <SelectTrigger id="unit-select" className="w-full">
                  <SelectValue placeholder="请选择单元...">{availableUnits.find((unit) => unit.unitId === selectedUnitId)?.unitName}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((u) => (
                    <SelectItem key={u.unitId} value={u.unitId}>
                      {u.unitName}（{u.words.length} 词）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            {progress && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setMode("task")}
              >
                取消
              </Button>
            )}
            <Button
              onClick={handleConfirmSelection}
              disabled={!selectedBookId || !selectedGradeId || !selectedUnitId}
              className="flex-1"
              size="lg"
            >
              <Target className="mr-2 h-4 w-4" />
              确认
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    { icon: BookOpen, tone: "bg-teal-50 text-primary", value: stats.totalArticles, label: "读过的文章", unit: "篇" },
    { icon: Library, tone: "bg-[#f5f0e4] text-[#a38a50]", value: stats.knownWords, label: "积累的单词", unit: "个" },
    { icon: Sparkles, tone: "bg-[#eeedf5] text-[#9182aa]", value: stats.knownGrammars, label: "学过的语法", unit: "个" },
    { icon: Flame, tone: "bg-[#fbefe6] text-[#b58667]", value: stats.streakDays, label: "连续学习", unit: "天" },
  ];

  return (
    <main className="page-container entry-reveal">
      <ContinueReading />
      <section className="relative mb-6 overflow-hidden rounded-[22px] border border-[#dfe5d3] bg-[#edf1e4] px-6 py-7 sm:px-8 sm:py-8">
        <div className="relative z-10">
          <p className="page-eyebrow mb-3 flex items-center gap-2 text-[#81916f]"><span className="size-1.5 rounded-full bg-[#90a378]" />YOUR DAILY CHAPTER</p>
          <h1 className="text-[25px] font-semibold leading-relaxed tracking-tight text-[#314b37] sm:text-[32px]">今天，也读一点英语。</h1>
          <p className="mt-2 max-w-md text-xs leading-6 text-[#72836a] sm:text-sm">新词藏在故事里，进步藏在每一天里。<br className="sm:hidden" />准备好开启今天的阅读了吗？</p>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-5 hidden size-56 items-center justify-center rounded-full border border-[#dbe3cd] md:flex">
          <div className="absolute size-40 rounded-full border border-[#dbe3cd]" />
          <div className="absolute top-[74px] h-[100px] w-[77px] rotate-[14deg] rounded-r-lg border border-[#c5ccaf] bg-[#d6ddc4] shadow-sm" />
          <div className="relative mt-6 flex h-[108px] w-[78px] -rotate-[12deg] flex-col justify-between rounded-r-lg border-l-4 border-[#315b42] bg-[#58754d] p-3 text-[#eef0df] shadow-md"><BookOpen className="size-5" strokeWidth={1} /><span className="font-reading text-[11px] leading-4">One story.<br />One step<br />forward.</span></div>
          <Leaf className="absolute bottom-5 right-8 size-10 rotate-12 text-[#8f9f79]" strokeWidth={1} />
        </div>
      </section>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-4 py-4 sm:py-5"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${s.tone}`}><s.icon className="size-[18px]" strokeWidth={1.6} /></span><div><p className="text-[23px] font-semibold leading-none tracking-tight text-zinc-800">{s.value}<span className="ml-1.5 text-[10px] font-normal text-zinc-400">{s.unit}</span></p><p className="mt-2 text-[10px] text-zinc-500">{s.label}</p></div></div>)}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_270px]">
        <div className="min-w-0 space-y-5">
          {remindBackup && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800">
              <AlertTriangle className="size-4 shrink-0" /><span>给积累留一份备份，换设备也能继续学习。</span>
              <div className="ml-auto flex shrink-0 gap-1">
                <Button size="sm" variant="outline" className="h-8 border-amber-200 bg-white text-xs text-amber-800" onClick={() => { void downloadBackup().then(() => { markBackupReminded(); setRemindBackup(false); }).catch(() => setError("备份未导出，请到学习统计重试。")); }}>立即备份</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-amber-700" onClick={() => { markBackupReminded(); setRemindBackup(false); }}>以后再说</Button>
              </div>
            </div>
          )}

          {stats.dueWords > 0 && mode === "task" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-200/60 bg-teal-50 px-4 py-3 text-xs leading-6 text-primary">
              <RefreshCw className="size-3.5 shrink-0" /><span className="min-w-0 flex-1">{stats.dueWords} 个词适合温习，本篇已经带上一部分。</span>
              <Button size="sm" variant="ghost" className="ml-auto h-7 shrink-0 text-[11px] text-primary" onClick={handleReviewOnly} disabled={loading}>只复习旧词<ArrowUpRight className="ml-1 size-3" /></Button>
            </div>
          )}

          {mode === "task" && progress ? renderTaskMode() : renderSelectMode()}
        </div>
        <LearningCompanion daily={daily} clozeCount={clozeCount} translateCount={translateCount} />
      </div>
      <p className="mt-10 text-center font-reading text-xs italic tracking-wide text-zinc-400">Every word has a story. Make it yours.</p>
    </main>
  );
}
