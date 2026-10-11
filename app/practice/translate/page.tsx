"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  buildTranslationTasks,
  saveTranslationRecord,
  looksLikeRealAttempt,
  type TranslationTask,
} from "@/lib/translation-practice";
import { useStoreVersion, useNow } from "@/lib/client-store";
import {
  Languages,
  Loader2,
  ArrowRight,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";

const SET_SIZE = 5;

interface GradeResult {
  score: number;
  accuracy?: number;
  completeness?: number;
  fluency?: number;
  verdict?: string;
  issues?: { type: string; detail: string }[];
  strengths?: string[];
  betterVersion?: string;
}

export default function TranslatePracticePage() {
  const router = useRouter();
  const version = useStoreVersion();
  const now = useNow();

  const [session, setSession] = useState(0);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);

  const hydrated = version >= 0 && now > 0;

  // 只在进入页面 / 换一组时选句，答题过程中不重算
  const tasks = useMemo<TranslationTask[] | null>(
    () => (hydrated ? buildTranslationTasks(SET_SIZE, Date.now()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, hydrated]
  );

  const current = tasks?.[index];
  const finished = !!tasks && index >= tasks.length;

  const handleSubmit = useCallback(async () => {
    if (!current || grading) return;

    // 随便糊弄的不发请求——省钱，也避免模型对空译文给出鼓励性高分
    if (!looksLikeRealAttempt(input)) {
      setError("先认真写一版中文翻译再提交");
      return;
    }

    setError("");
    setGrading(true);
    try {
      const res = await fetch("/api/grade-translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentence: current.sentence,
          reference: current.reference,
          input,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "评分失败");

      setResult(data);
      saveTranslationRecord({
        articleId: current.articleId,
        sentence: current.sentence,
        input,
        score: typeof data.score === "number" ? data.score : 0,
        completedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "评分失败，请重试");
    } finally {
      setGrading(false);
    }
  }, [current, input, grading]);

  function handleNext() {
    setIndex((i) => i + 1);
    setInput("");
    setResult(null);
    setError("");
    setShowAnalysis(false);
  }

  if (!tasks) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center text-zinc-400 lg:px-8">
        加载中...
      </main>
    );
  }

  // ====== 没句子可练 ======
  if (tasks.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <p className="page-eyebrow mb-3">BEYOND THE WORDS</p>
        <h1 className="page-heading mb-7">把理解，写成自己的话。</h1>
        <Card className="border-dashed border-zinc-300">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-teal-50"><Languages className="size-7 text-teal-400" strokeWidth={1.5} /></span>
            <p className="font-medium text-zinc-700">暂时没有可练的长难句</p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500">
              翻译题只从你读过的文章里挑长难句。多读几篇考研难度的文章，
              这里就会有题了。
            </p>
            <Button className="mt-5" onClick={() => router.push("/")}>
              <BookOpen className="mr-2 h-4 w-4" />
              去读今天这篇
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ====== 练完 ======
  if (finished) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
            <CheckCircle2 className="h-7 w-7 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">这组翻译练完了</h1>
          <p className="mt-1 text-sm text-zinc-500">
            练了 {tasks.length} 个长难句
          </p>
        </div>
        <div className="mt-6 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-1"
            onClick={() => {
              setSession((s) => s + 1);
              setIndex(0);
              setInput("");
              setResult(null);
              setShowAnalysis(false);
            }}
          >
            <RefreshCw className="h-4 w-4" />
            再来一组
          </Button>
          <Button className="flex-1 gap-1" onClick={() => router.push("/")}>
            <BookOpen className="h-4 w-4" />
            去读文章
          </Button>
        </div>
      </main>
    );
  }

  const task = current!;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 lg:max-w-4xl lg:px-8">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>
            {index + 1} / {tasks.length}
          </span>
          <span className="flex items-center gap-1">
            <Languages className="h-3.5 w-3.5" />
            英译汉 · 考研英语一 10 分题型
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${(index / tasks.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="border-zinc-200">
        <CardContent className="p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-xs text-zinc-400">
              出自你读过的《{task.articleTitle}》
            </p>
            {task.dueWords.length > 0 && (
              <Badge className="bg-emerald-100 text-[10px] text-emerald-700 hover:bg-emerald-100">
                含 {task.dueWords.length} 个正在复习的词
              </Badge>
            )}
          </div>

          <p className="text-lg leading-relaxed text-zinc-800">{task.sentence}</p>

          {/* 卡住时可以看结构拆解，但要主动点开 */}
          {task.analysis?.constituents && task.analysis.constituents.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                {showAnalysis ? "收起结构提示" : "卡住了？看句子结构"}
              </button>
              {showAnalysis && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {task.analysis.constituents.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-md border border-teal-100 bg-teal-50 px-2 py-1 text-xs"
                    >
                      <span className="text-zinc-700">{c.text}</span>
                      <span className="ml-1 text-teal-600">{c.label}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator className="my-5" />

          {!result ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-zinc-900">
                写出你的中文翻译
              </label>
              <Textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError("");
                }}
                placeholder="尽量把从句和修饰关系理清楚，不要逐词硬译..."
                className="min-h-[110px] text-sm"
                disabled={grading}
              />
              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={grading}
              >
                {grading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在评分...
                  </>
                ) : (
                  "提交批改"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 分数 */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p
                    className={`text-3xl font-bold ${
                      result.score >= 8
                        ? "text-green-600"
                        : result.score >= 5
                        ? "text-amber-600"
                        : "text-red-600"
                    }`}
                  >
                    {result.score}
                    <span className="text-base text-zinc-400">/10</span>
                  </p>
                </div>
                <div className="flex-1 space-y-1 text-xs text-zinc-500">
                  {[
                    ["准确性", result.accuracy, 4],
                    ["完整性", result.completeness, 3],
                    ["通顺度", result.fluency, 3],
                  ].map(([label, value, max]) => (
                    <div key={String(label)} className="flex items-center gap-2">
                      <span className="w-12 shrink-0">{label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-teal-400"
                          style={{
                            width: `${((Number(value) || 0) / Number(max)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right">
                        {Number(value) || 0}/{String(max)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {result.verdict && (
                <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  {result.verdict}
                </p>
              )}

              {/* 具体问题——这是练习的价值所在 */}
              {result.issues && result.issues.length > 0 && (
                <div className="space-y-2">
                  {result.issues.map((issue, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {issue.type}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700">{issue.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {result.strengths && result.strengths.length > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  {result.strengths.map((s, i) => (
                    <p key={i} className="text-sm text-green-800">
                      ✓ {s}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-500">你的翻译</p>
                  <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    {input}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-zinc-500">参考译文</p>
                  <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-zinc-700">
                    {task.reference}
                  </p>
                </div>
                {result.betterVersion &&
                  result.betterVersion !== task.reference && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-zinc-500">
                        更好的译法
                      </p>
                      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-zinc-700">
                        {result.betterVersion}
                      </p>
                    </div>
                  )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/article?id=${task.articleId}`}
                  className="text-xs text-zinc-400 hover:text-teal-600"
                >
                  查看原文
                </Link>
                <Button className="ml-auto gap-1" onClick={handleNext}>
                  {index < tasks.length - 1 ? "下一句" : "看结果"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
