"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReadingPreview } from "@/components/reading-preview";
import { openDemoArticle } from "@/lib/demo-article";
import { EducationLevel } from "@/lib/types";
import {
  PLACEMENT_SIZE,
  buildPlacementSet,
  estimatePlacement,
  seedWordBookFromPlacement,
  progressFromPlacement,
  unknownWordsAsItems,
  getAvailableStages,
  getVocabularyTarget,
  type PlacementAnswer,
  type PlacementResult,
  type PlacementWord,
} from "@/lib/placement";
import { saveProgress } from "@/lib/storage";
import { buildLessonPlan } from "@/lib/lesson-plan";
import { generateArticleFromPlan } from "@/lib/generate-article";
import {
  BookOpen,
  Check,
  X,
  Loader2,
  Sparkles,
  RefreshCw,
  ArrowRight,
  GraduationCap,
  Leaf,
  Clock3,
  ArrowLeft,
} from "lucide-react";

type Step = "stage" | "quiz" | "result";

const GENERATION_STEPS = [
  "正在编排你的第一篇文章...",
  "正在撰写...",
  "正在做逐句解析...",
  "就快好了...",
];

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("stage");
  const [stage, setStage] = useState<EducationLevel | null>(null);
  const [words, setWords] = useState<PlacementWord[]>([]);
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const generationRef = useRef<AbortController | null>(null);
  useEffect(() => () => generationRef.current?.abort(), []);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState("");

  const stages = useMemo(() => getAvailableStages(), []);
  const current = words[answers.length];

  function handlePickStage(level: EducationLevel) {
    setStage(level);
    setWords(buildPlacementSet(level));
    setAnswers([]);
    setStep("quiz");
  }

  function handleAnswer(known: boolean) {
    if (!current || !stage) return;
    const next = [...answers, { word: current.word, tier: current.tier, known }];
    setAnswers(next);

    if (next.length >= words.length) {
      const estimated = estimatePlacement(next, stage);
      setResult(estimated);
      seedWordBookFromPlacement(estimated);
      setStep("result");
    }
  }

  function handleUndo() {
    setAnswers((prev) => prev.slice(0, -1));
  }

  async function handleStart() {
    if (!result) return;
    setError("");
    setLoading(true);

    const controller = new AbortController(); generationRef.current = controller;

    try {
      const progress = progressFromPlacement(result);
      if (progress) saveProgress(progress);

      // 把「刚说不认识的词」作为自定义词直接编进第一篇——
      // 这样第一次打开就能看见产品的核心：文章是围绕你的缺口生成的
      const plan = buildLessonPlan({
        progress,
        customWords: unknownWordsAsItems(result),
        mode: "custom",
      });

      const article = await generateArticleFromPlan(plan, { signal: controller.signal, onStage: (stage) => setProgressStep(stage === "writing" ? 1 : 2) });
      router.push(`/article?id=${article.id}`);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "生成失败，请重试");
      setLoading(false);
    }
  }

  // ====== 第一步：选学段 ======
  if (step === "stage") {
    return (
      <main className="page-container entry-reveal">
        <div className="grid items-start gap-10 xl:grid-cols-[1.05fr_1fr] xl:gap-16">
          <section>
            <p className="page-eyebrow mb-5 flex items-center gap-2"><span className="h-px w-6 bg-teal-500" />A NEW CHAPTER · 新的开始</p>
            <h1 className="text-[34px] font-semibold leading-[1.4] tracking-tight text-zinc-900 sm:text-[44px]">让单词，<br />在故事里<span className="relative text-primary">被记住<span aria-hidden="true" className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-[#cad8b5]" /></span>。</h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-zinc-500">从一篇为你而写的英文文章开始。<br className="hidden sm:block" />在阅读中遇见新词，在新的故事里，和老朋友重逢。</p>
            <div className="mt-7">
              <Button size="lg" onClick={() => { try { router.push(`/article?id=${openDemoArticle()}`); } catch { setError("体验文章保存失败，请检查浏览器存储空间。"); } }} className="gap-2">先读一篇，体验 1 分钟 <ArrowRight className="size-4" /></Button>
              <p className="mt-3 text-xs leading-6 text-zinc-500">无需测试，无需等待。点词看释义，点句子看解析。</p>
              {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
            </div>
            <div className="hidden xl:block"><ReadingPreview /></div>
          </section>

          <section className="rounded-[24px] border border-zinc-200/80 bg-white p-6 shadow-[0_8px_32px_-24px_#23352b33] sm:p-8 xl:mt-3" aria-labelledby="choose-stage">
            <div className="mb-8 flex items-center gap-2 text-[11px]">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-white">1</span><span className="font-medium text-primary">选择方向</span><span className="mx-1 h-px flex-1 bg-zinc-200" /><span className="flex size-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">2</span><span className="text-zinc-400">词汇摸底</span><span className="mx-1 h-px flex-1 bg-zinc-200" /><span className="flex size-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">3</span><span className="text-zinc-400">开始阅读</span>
            </div>
            <h2 id="choose-stage" className="text-[22px] font-semibold tracking-tight">你想从哪里开始？</h2>
            <p className="mt-2 text-xs leading-6 text-zinc-500">选择你的学习阶段，我们来找到适合你的起点。</p>
            <div className="mt-6 space-y-3">
              {stages.map((s) => (
                <button type="button" key={s.level} onClick={() => handlePickStage(s.level)}
                  className={`group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-sm sm:gap-4 sm:p-5 ${s.primary ? "border-teal-200 bg-teal-50/80" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}>
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${s.primary ? "bg-primary text-white" : "bg-[#f3f1e9] text-[#9b8d6c]"}`}>{s.level === "primary" ? <Leaf className="size-5" strokeWidth={1.6} /> : s.level === "junior" ? <BookOpen className="size-5" strokeWidth={1.6} /> : <GraduationCap className="size-5" strokeWidth={1.6} />}</span>
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold">{s.label}{s.primary && <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-medium text-primary ring-1 ring-teal-200">推荐</span>}</span><span className="mt-1.5 block text-[11px] leading-5 text-zinc-500">{s.description}</span></span>
                  <ArrowRight className="size-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-2 border-t border-zinc-100 pt-5 text-[11px] leading-6 text-zinc-500"><Clock3 className="mt-1 size-3.5 shrink-0" /><p>接下来用约 30 秒认识你的词汇量。<br />不计分、不排名，凭直觉回答就好。</p></div>
          </section>
        </div>
        <div className="mt-10 grid gap-5 border-t border-zinc-200/80 pt-6 sm:grid-cols-3 xl:mt-12">
          {[{ icon: Sparkles, title: "为你而写", text: "把你的生词，写进有意思的文章" }, { icon: BookOpen, title: "读懂每一句", text: "词义、翻译和长难句，一点就懂" }, { icon: RefreshCw, title: "让记忆生根", text: "学过的内容，在新语境中自然复现" }].map((item) => <div key={item.title} className="flex items-start gap-3"><item.icon className="mt-1 size-4 shrink-0 text-teal-500" strokeWidth={1.5} /><div><p className="text-xs font-medium text-zinc-700">{item.title}</p><p className="mt-1 text-[11px] leading-5 text-zinc-500">{item.text}</p></div></div>)}
        </div>
      </main>
    );
  }

  // ====== 第二步：摸底 ======
  if (step === "quiz" && current) {
    const done = answers.length;
    const percent = Math.round((done / words.length) * 100);

    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 lg:px-8">
        <div className="mb-7 flex items-center justify-between"><button type="button" onClick={() => setStep("stage")} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-primary"><ArrowLeft className="size-3.5" />重新选择方向</button><span className="page-eyebrow">02 / FIND YOUR PACE</span></div>
        <h1 className="mb-2 text-center text-2xl font-semibold">从熟悉的单词开始</h1>
        <p className="mb-8 text-center text-xs leading-6 text-zinc-500">不需要查词，告诉我们你的第一感觉。</p>
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>
              {done} / {words.length}
            </span>
            <button
              type="button"
              onClick={handleUndo}
              disabled={done === 0}
              className="text-zinc-400 hover:text-zinc-700 disabled:opacity-0"
            >
              上一个
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-teal-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <Card className="border-zinc-200">
          <CardContent className="px-6 py-14 text-center">
            <p className="mb-2 text-xs text-zinc-400">这个词你认识吗？</p>
            <p className="font-reading text-5xl tracking-tight text-zinc-900 sm:text-6xl">
              {current.word}
            </p>
          </CardContent>
        </Card>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-14 gap-2 border-zinc-300 text-zinc-600"
            onClick={() => handleAnswer(false)}
          >
            <X className="h-4 w-4" />
            不认识
          </Button>
          <Button
            size="lg"
            className="h-14 gap-2"
            onClick={() => handleAnswer(true)}
          >
            <Check className="h-4 w-4" />
            认识
          </Button>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-400">
          凭感觉快速判断就好，不用纠结
        </p>
      </main>
    );
  }

  // ====== 第三步：结果 ======
  if (step === "result" && result) {
    const vocabTarget = getVocabularyTarget(result.suggestedLevel);
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 lg:px-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
            <Sparkles className="h-6 w-6 text-amber-500" />
          </div>
          <h1 className="mb-5 text-xl font-semibold text-zinc-900">找到你的起点了</h1>
          <p className="text-sm text-zinc-500">你的词汇量约</p>
          <p className="my-1 text-5xl font-bold tracking-tight text-zinc-900">
            {result.estimatedVocabulary.toLocaleString()}
          </p>
          <p className="text-sm text-zinc-500">
            个单词 · {PLACEMENT_SIZE} 题中认识 {result.knownCount} 个
          </p>

          {/* 考研用户最关心的是「离大纲还差多少」，给一个明确的对照 */}
          {vocabTarget.label && (
            <div className="mx-auto mt-4 max-w-xs">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (result.estimatedVocabulary / vocabTarget.total) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">
                {vocabTarget.label}
                {result.estimatedVocabulary < vocabTarget.total && (
                  <>
                    ，还差约{" "}
                    <b className="text-zinc-700">
                      {(
                        vocabTarget.total - result.estimatedVocabulary
                      ).toLocaleString()}
                    </b>{" "}
                    词
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        <Card className="border-teal-200 bg-teal-50/40">
          <CardContent className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <RefreshCw className="h-4 w-4 text-teal-600" />
              接下来这篇文章，会用上你不认识的这些词
            </h2>

            {result.unknownWords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.unknownWords.map((w) => (
                  <Badge
                    key={w}
                    variant="outline"
                    className="border-teal-200 bg-white text-teal-700"
                  >
                    {w}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                这些词你全认识！第一篇会用同难度的新词来试试你。
              </p>
            )}

            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              读完之后它们会进入你的单词本。往后每一篇文章都会按遗忘曲线，
              自动把还没记牢的词重新编进去——你不用再单独背单词。
            </p>
          </CardContent>
        </Card>

        {result.knownWords.length > 0 && (
          <p className="mt-4 text-center text-xs text-zinc-400">
            认识的 {result.knownWords.length} 个词已记入单词本，不会占用复习名额
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {GENERATION_STEPS[progressStep]}
            </>
          ) : (
            <>
              <BookOpen className="mr-2 h-4 w-4" />
              生成我的第一篇文章
            </>
          )}
        </Button>
        {loading && (
          <div className="mt-2 text-center"><p className="text-xs text-zinc-500">正在为你准备文章，较长内容可能需要一分钟。</p><Button variant="ghost" size="sm" onClick={() => { generationRef.current?.abort(); setLoading(false); setError("已取消。你的摸底结果已保留，可以稍后再试。"); }}>取消本次生成</Button></div>
        )}

        <button
          type="button"
          onClick={() => {
            setStep("stage");
            setAnswers([]);
            setResult(null);
          }}
          disabled={loading}
          className="mx-auto mt-4 block text-xs text-zinc-400 hover:text-zinc-600 disabled:opacity-50"
        >
          重新测一次
        </button>
      </main>
    );
  }

  return null;
}
