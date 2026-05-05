"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  WORD_PHRASES,
  type WordItem,
  type EducationLevel,
  getGrammarsByIds,
} from "@/lib/types";
import { saveArticle, getLearningStats } from "@/lib/storage";
import { getProgress, saveProgress } from "@/lib/storage";
import {
  getAllBooks,
  getGradesByBook,
  getUnitsByGrade,
  getUnitById,
  getWordsByUnit,
  getGrammarIdsByUnit,
  getNextUnit,
} from "@/lib/official-words";
import {
  Loader2, Sparkles, BookOpen, Target, Flame, Zap,
  ChevronRight, RotateCcw, Library,
} from "lucide-react";

export default function Home() {
  const router = useRouter();

  // ====== 状态 ======
  const [progress, setProgress] = useState<ReturnType<typeof getProgress>>(null);
  const [mode, setMode] = useState<"task" | "select">("task");

  // 教材选择状态
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recommending, setRecommending] = useState(false);
  const [recommendedWords, setRecommendedWords] = useState<WordItem[]>([]);
  const [recommendedGrammars, setRecommendedGrammars] = useState<
    { id: string; name: string; nameEn: string; category: string; description: string }[]
  >([]);
  const [stats, setStats] = useState({
    totalArticles: 0,
    streakDays: 0,
    masteredWords: 0,
    masteredGrammars: 0,
    lastStudyDate: "",
    avgSentenceClicks: 0,
  });


  // 自定义生成模式（保留旧入口）
  const [showCustom, setShowCustom] = useState(false);

  // ====== 数据计算 ======
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

  const selectedUnit = useMemo(
    () =>
      selectedBookId && selectedGradeId && selectedUnitId
        ? getUnitById(selectedBookId, selectedGradeId, selectedUnitId)
        : null,
    [selectedBookId, selectedGradeId, selectedUnitId]
  );

  // 当前进度对应的单元
  const currentUnit = useMemo(() => {
    if (!progress) return null;
    return getUnitById(progress.bookId, progress.gradeId, progress.unitId);
  }, [progress]);

  const currentBook = useMemo(() => {
    if (!progress) return null;
    return allBooks.find((b) => b.id === progress.bookId);
  }, [progress, allBooks]);

  const currentGrade = useMemo(() => {
    if (!progress) return null;
    const grades = getGradesByBook(progress.bookId);
    return grades.find((g) => g.gradeId === progress.gradeId);
  }, [progress]);

  // ====== 初始化 ======
  useEffect(() => {
    const p = getProgress();
    setProgress(p);
    setStats(getLearningStats());
    if (!p) {
      setMode("select");
    }
  }, []);

  // ====== 调用大模型推荐单词和语法 ======
  useEffect(() => {
    if (!progress) return;
    async function fetchRecommended() {
      setRecommending(true);
      try {
        const res = await fetch("/api/recommend-words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gradeId: progress!.gradeId }),
        });
        const data = await res.json();
        if (res.ok) {
          setRecommendedWords(data.words || []);
          setRecommendedGrammars(data.grammars || []);
        }
      } catch {
        // 静默失败，使用默认数据
      } finally {
        setRecommending(false);
      }
    }
    fetchRecommended();
  }, [progress?.gradeId, progress?.unitId]);

  // ====== 教材选择处理 ======
  const handleBookChange = useCallback(
    (bookId: string | null) => {
      setSelectedBookId(bookId || "");
      setSelectedGradeId("");
      setSelectedUnitId("");
    },
    []
  );

  const handleGradeChange = useCallback(
    (gradeId: string | null) => {
      setSelectedGradeId(gradeId || "");
      setSelectedUnitId("");
    },
    []
  );

  // ====== 确认选择并保存进度 ======
  const handleConfirmSelection = useCallback(() => {
    if (!selectedBookId || !selectedGradeId || !selectedUnitId) return;
    const newProgress = {
      bookId: selectedBookId,
      gradeId: selectedGradeId,
      unitId: selectedUnitId,
      completedUnits: progress?.completedUnits ?? [],
    };
    saveProgress(newProgress);
    setProgress(newProgress);
    setMode("task");
  }, [selectedBookId, selectedGradeId, selectedUnitId, progress]);

  // ====== 生成文章核心逻辑 ======
  async function generateForUnit(
    bookId: string,
    gradeId: string,
    unitId: string
  ) {
    // 优先使用大模型推荐的单词和语法
    let wordItems: WordItem[] = recommendedWords;
    let grammars = recommendedGrammars;

    // 如果推荐数据还没准备好，回退到本地教材数据
    if (wordItems.length === 0) {
      const words = getWordsByUnit(bookId, gradeId, unitId);
      wordItems = words.map((word) => ({
        word,
        phrases: WORD_PHRASES[word.toLowerCase()],
      }));
    }
    if (grammars.length === 0) {
      const grammarIds = getGrammarIdsByUnit(bookId, gradeId, unitId);
      grammars = getGrammarsByIds(grammarIds);
    }

    if (wordItems.length === 0) {
      throw new Error("该单元没有单词数据");
    }
    if (grammars.length === 0) {
      throw new Error("该单元没有语法数据");
    }

    // 根据年级推断 GradeOption
    const gradeOpt = inferGradeOption(gradeId);

    // 随机选择题材
    const themes: Array<
      "story" | "news" | "sci-fi" | "daily" | "adventure" | "social" | "frontier" | "economy" | "livelihood" | "biography" | "travel" | "history" | "nature"
    > = [
      "story", "news", "sci-fi", "daily", "adventure", "social",
      "frontier", "economy", "livelihood", "biography", "travel", "history", "nature",
    ];
    const theme = themes[Math.floor(Math.random() * themes.length)];
    const style = "exam-graduate" as const;

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        words: wordItems,
        grammars,
        grade: gradeOpt,
        theme,
        style,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "生成失败");
    }

    const article = {
      id: Date.now().toString(),
      title: data.title || "无标题",
      content: data.content || "",
      translation: data.translation || "",
      words: wordItems,
      grammar: grammars,
      difficulty: {
        level: gradeOpt.level as EducationLevel,
        gradeId: gradeOpt.id,
      },
      sentences: Array.isArray(data.sentences) ? data.sentences : [],
      quiz: Array.isArray(data.quiz) ? data.quiz : [],
      wordUsages: data.wordUsages || {},
      theme,
      style,
      createdAt: Date.now(),
    };

    saveArticle(article);
    return article.id;
  }

  // 根据 gradeId 推断 GradeOption
  function inferGradeOption(gradeId: string) {
    const map: Record<string, { id: string; name: string; level: string; cefr: string; description: string }> = {
      p3: { id: "p3", name: "三年级", level: "primary", cefr: "A1", description: "简单问答和描述，使用现在时，句长 5-8 词" },
      p4: { id: "p4", name: "四年级", level: "primary", cefr: "A1", description: "能写简单段落，引入过去时，词汇量 500-800" },
      p5: { id: "p5", name: "五年级", level: "primary", cefr: "A1+", description: "连词使用增加，能描述计划与喜好，句型稍复杂" },
      p6: { id: "p6", name: "六年级", level: "primary", cefr: "A2", description: "简单复合句，时态混合，能写 80-100 词短文" },
      j1: { id: "j1", name: "初一", level: "junior", cefr: "A2", description: "基础语法完整覆盖，能进行日常话题的连贯表达" },
      j2: { id: "j2", name: "初二", level: "junior", cefr: "A2+", description: "多种时态混合，从句初现，文章长度 120-150 词" },
      j3: { id: "j3", name: "初三", level: "junior", cefr: "B1", description: "中考难度，逻辑连接词丰富，能表达观点和原因" },
      s1: { id: "s1", name: "高一", level: "senior", cefr: "B1", description: "篇章结构清晰，词汇量 2500+，能处理抽象话题" },
      s2: { id: "s2", name: "高二", level: "senior", cefr: "B1+", description: "复杂句式增多，语态和从句灵活运用，接近高考难度" },
      s3: { id: "s3", name: "高三", level: "senior", cefr: "B2", description: "高考及略高于高考，论证性表达，词汇精准" },
      g1: { id: "g1", name: "考研基础", level: "graduate", cefr: "C1", description: "考研高频核心词 + 基础语法，文章长度 400-500 词，议论为主" },
      g2: { id: "g2", name: "考研强化", level: "graduate", cefr: "C1+", description: "考研大纲全词 + 长难句分析，文章长度 450-600 词，论证复杂" },
      g3: { id: "g3", name: "考研冲刺", level: "graduate", cefr: "C2", description: "真题难度，长难句密集，抽象话题，文章长度 500-700 词" },
    };
    return map[gradeId] || map["j2"];
  }

  // ====== 开始学习 ======
  async function handleStartLearning() {
    if (!progress) return;
    setError("");
    setLoading(true);
    try {
      const articleId = await generateForUnit(
        progress.bookId,
        progress.gradeId,
        progress.unitId
      );
      router.push(`/article?id=${articleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
      setLoading(false);
    }
  }

  // ====== 切换到下一单元 ======
  function handleNextUnit() {
    if (!progress) return;
    const next = getNextUnit(progress.bookId, progress.gradeId, progress.unitId);
    if (next) {
      const updated = { ...progress, unitId: next.unitId };
      saveProgress(updated);
      setProgress(updated);
    }
  }

  // ====== 渲染：今日任务模式 ======
  function renderTaskMode() {
    if (!progress || !currentUnit) return null;

    const words = recommendedWords.length > 0
      ? recommendedWords.map((w) => w.word)
      : getWordsByUnit(progress.bookId, progress.gradeId, progress.unitId);
    const grammars = recommendedGrammars.length > 0
      ? recommendedGrammars
      : getGrammarsByIds(getGrammarIdsByUnit(progress.bookId, progress.gradeId, progress.unitId));

    return (
      <div className="space-y-6">
        {/* 今日任务卡片 */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">今日任务</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 单元信息 */}
            <div className="rounded-lg bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">
                    {currentBook?.name} · {currentGrade?.gradeName}
                  </p>
                  <p className="text-lg font-bold text-zinc-900">
                    {currentUnit.unitName}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {recommending ? "..." : `${words.length} 词`}
                </Badge>
              </div>
            </div>

            {/* 单词预览 */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">
                今日推荐单词
              </p>
              {recommending ? (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI 正在推荐单词...
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {words.slice(0, 12).map((w, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-xs font-normal"
                    >
                      {w}
                    </Badge>
                  ))}
                  {words.length > 12 && (
                    <span className="text-xs text-zinc-400">
                      +{words.length - 12}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 语法点预览 */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">
                核心语法
              </p>
              {recommending ? (
                <div className="text-xs text-zinc-400">加载中...</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {grammars.map((g) => (
                    <Badge
                      key={g.id}
                      variant="outline"
                      className="border-blue-200 bg-white text-blue-700 text-xs"
                    >
                      {g.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button
              onClick={handleStartLearning}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在生成文章...
                </>
              ) : (
                <>
                  <BookOpen className="mr-2 h-4 w-4" />
                  开始学习
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
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
          {getNextUnit(progress.bookId, progress.gradeId, progress.unitId) && (
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

  // ====== 渲染：教材选择模式 ======
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
          {/* 步骤1：选教材 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-900">
              教材版本 <span className="text-red-500">*</span>
            </label>
            <Select value={selectedBookId} onValueChange={handleBookChange}>
              <SelectTrigger>
                <SelectValue placeholder="请选择教材..." />
              </SelectTrigger>
              <SelectContent>
                {allBooks.map((book) => (
                  <SelectItem key={book.id} value={book.id}>
                    {book.name}（{book.level === "primary" ? "小学" : book.level === "junior" ? "初中" : "考研"}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 步骤2：选年级 */}
          {selectedBookId && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-900">
                年级 <span className="text-red-500">*</span>
              </label>
              <Select value={selectedGradeId} onValueChange={handleGradeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择年级..." />
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

          {/* 步骤3：选单元 */}
          {selectedGradeId && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-900">
                当前单元 <span className="text-red-500">*</span>
              </label>
              <Select
                value={selectedUnitId}
                onValueChange={(v) => setSelectedUnitId(v || "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择单元..." />
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

          {/* 预览 */}
          {selectedUnit && (
            <div className="rounded-lg bg-zinc-50 p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">单词预览</p>
                <div className="flex flex-wrap gap-1">
                  {selectedUnit.words.slice(0, 8).map((w, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-normal">
                      {w}
                    </Badge>
                  ))}
                  {selectedUnit.words.length > 8 && (
                    <span className="text-xs text-zinc-400">+{selectedUnit.words.length - 8}</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">语法点</p>
                <div className="flex flex-wrap gap-1">
                  {getGrammarsByIds(selectedUnit.grammarIds).map((g) => (
                    <Badge key={g.id} variant="outline" className="text-xs">
                      {g.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleConfirmSelection}
            disabled={!selectedBookId || !selectedGradeId || !selectedUnitId}
            className="w-full"
            size="lg"
          >
            <Target className="mr-2 h-4 w-4" />
            确认并开始学习
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ====== 渲染：自定义生成（保留旧入口）======
  function renderCustomEntry() {
    return (
      <div className="mt-4 text-center">
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs text-zinc-400 hover:text-zinc-600 underline"
        >
          {showCustom ? "收起" : "高级：自定义生成文章"}
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      {/* 标题 */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          跟着教材学英语
        </h1>
        <p className="mt-3 text-zinc-600">
          选择你的教材单元，AI 为你生成专属阅读文章
        </p>
      </div>

      {/* 学习统计 */}
      {stats.totalArticles > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-zinc-200">
            <CardContent className="flex items-center gap-3 py-4">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-lg font-bold text-zinc-900">{stats.totalArticles}</p>
                <p className="text-xs text-zinc-500">已读文章</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-zinc-200">
            <CardContent className="flex items-center gap-3 py-4">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-lg font-bold text-zinc-900">{stats.masteredWords}</p>
                <p className="text-xs text-zinc-500">已学单词</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-zinc-200">
            <CardContent className="flex items-center gap-3 py-4">
              <Zap className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-lg font-bold text-zinc-900">{stats.masteredGrammars}</p>
                <p className="text-xs text-zinc-500">已学语法</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-zinc-200">
            <CardContent className="flex items-center gap-3 py-4">
              <Flame className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-lg font-bold text-zinc-900">{stats.streakDays}</p>
                <p className="text-xs text-zinc-500">连续天数</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 主内容区 */}
      {mode === "task" && progress ? renderTaskMode() : renderSelectMode()}

    </main>
  );
}
