"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BLANK,
  buildClozeSet,
  checkCloze,
  firstLetterHint,
  type ClozeQuestion,
  type ClozeVerdict,
} from "@/lib/cloze";
import { gradeWord } from "@/lib/wordbook";
import { beginDailyReview, recordReviewForGoal } from "@/lib/daily-goal";
import { withLearningTransaction } from "@/lib/learning-transaction";
import { useStoreVersion, useNow } from "@/lib/client-store";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  Trophy,
  RotateCcw,
  Quote,
} from "lucide-react";

const SET_SIZE = 5;

interface Answered {
  question: ClozeQuestion;
  verdict: ClozeVerdict;
  input: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const version = useStoreVersion();
  const now = useNow();
  const inputRef = useRef<HTMLInputElement>(null);

  /** 换一组题时 +1；答题过程中保持不变 */
  const [session, setSession] = useState(0);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState<ReturnType<typeof checkCloze> | null>(
    null
  );
  const [showHint, setShowHint] = useState(false);
  const [history, setHistory] = useState<Answered[]>([]);
  const [saveError, setSaveError] = useState("");
  const submittedRef = useRef(false);

  const hydrated = version >= 0 && now > 0;

  /**
   * 只在进入页面（或点「再来一组」）时组题。
   *
   * 刻意不依赖 version / now：每答一题都会写 SRS 从而 bump version，
   * 跟着重算会把题目在答题中途换掉。
   */
  const questions = useMemo<ClozeQuestion[] | null>(
    () => (hydrated ? buildClozeSet({ limit: SET_SIZE, now: Date.now() }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, hydrated]
  );

  const current = questions?.[index];
  const finished = !!questions && index >= questions.length;

  useEffect(() => {
    if (!revealed) inputRef.current?.focus();
  }, [index, revealed]);

  const handleSubmit = useCallback(() => {
    if (!current || revealed || submittedRef.current) return;
    const result = checkCloze(current, input);

    // 记住了就拉长间隔；没记住当天重来，并会被排进下一篇文章的队首。
    // 「差一点」（词对形态错）按 hard 处理——比全错宽容，但不算完全掌握。
    try {
      withLearningTransaction(() => {
        beginDailyReview();
        gradeWord(
          current.entryId,
          result.verdict === "correct"
            ? "good"
            : result.verdict === "close"
            ? "hard"
            : "again"
        );
        recordReviewForGoal(1);
      });
      submittedRef.current = true;
      setSaveError(""); setRevealed(result);
      setHistory((prev) => [...prev, { question: current, verdict: result.verdict, input }]);
    } catch {
      setSaveError("这次练习还没能保存，请先导出备份、腾出空间后重试。你的答案仍然保留。");
    }
  }, [current, input, revealed]);

  const handleNext = useCallback(() => {
    submittedRef.current = false;
    setIndex((i) => i + 1);
    setInput("");
    setRevealed(null);
    setShowHint(false);
  }, []);

  function handleRestart() {
    submittedRef.current = false;
    setSession((s) => s + 1);
    setIndex(0);
    setInput("");
    setRevealed(null);
    setShowHint(false);
    setHistory([]);
  }

  const stats = useMemo(() => {
    const correct = history.filter((h) => h.verdict === "correct").length;
    const close = history.filter((h) => h.verdict === "close").length;
    return { correct, close, wrong: history.length - correct - close };
  }, [history]);

  if (!questions) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center text-zinc-400 lg:px-8">
        加载中...
      </main>
    );
  }

  // ====== 没题可做 ======
  if (questions.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 lg:px-8">
        <p className="page-eyebrow mb-3">WORDS IN CONTEXT</p>
        <h1 className="page-heading mb-7">在语境里，温故知新。</h1>
        <Card className="border-dashed border-zinc-300">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-teal-50"><Quote className="size-7 text-teal-400" strokeWidth={1.5} /></span>
            <p className="font-medium text-zinc-700">还没有可以练的词</p>
            <p className="mt-1 max-w-xs text-sm text-zinc-500">
              语境填空只出你在文章里真正读到过的词。先读一篇，
              读到的词就会进入这里。
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

  // ====== 做完了 ======
  if (finished) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 lg:px-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Trophy className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">这组练完了</h1>
          <p className="mt-1 text-sm text-zinc-500">
            答对 {stats.correct}
            {stats.close > 0 && ` · 差一点 ${stats.close}`}
            {stats.wrong > 0 && ` · 没记住 ${stats.wrong}`}
            {" · 共 "}
            {history.length} 题
          </p>
          {stats.wrong > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              没记住的 {stats.wrong} 个词会排进下一篇文章的队首
            </p>
          )}
        </div>

        <div className="space-y-2">
          {history.map((h, i) => (
            <Card
              key={i}
              className={
                h.verdict === "correct"
                  ? "border-green-200"
                  : h.verdict === "close"
                  ? "border-amber-200"
                  : "border-red-200"
              }
            >
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <span className="font-medium text-zinc-900">
                    {h.question.surface}
                  </span>
                  {h.question.meaning && (
                    <span className="ml-2 text-xs text-zinc-500">
                      {h.question.meaning}
                    </span>
                  )}
                </div>
                {h.verdict === "correct" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <span className="shrink-0 text-xs text-zinc-400">
                    {h.input.trim() ? `你写了 ${h.input}` : "未作答"}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1 gap-1" onClick={handleRestart}>
            <RotateCcw className="h-4 w-4" />
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

  // ====== 答题中 ======
  const [before, after] = current!.prompt.split(BLANK);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 lg:px-8">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
          <span>
            {index + 1} / {questions.length}
          </span>
          <span>语境填空</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(index / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="border-zinc-200">
        <CardContent className="p-6">
          <p className="mb-3 text-xs text-zinc-400">
            这句话出自你读过的《{current!.articleTitle}》
          </p>

          <p className="text-lg leading-relaxed text-zinc-800">
            {before}
            <span
              className={`mx-1 inline-block min-w-[5rem] border-b-2 px-2 text-center font-semibold ${
                revealed
                  ? revealed.verdict === "correct"
                    ? "border-green-500 text-green-700"
                    : "border-red-400 text-red-600"
                  : "border-zinc-400 text-zinc-400"
              }`}
            >
              {revealed ? revealed.expected : "?"}
            </span>
            {after}
          </p>

          {current!.meaning && (
            <p className="mt-3 text-sm text-zinc-500">
              提示词义：{current!.meaning}
            </p>
          )}

          {showHint && !revealed && (
            <p className="mt-1 font-mono text-sm text-amber-600">
              首字母：{firstLetterHint(current!.answer)}
            </p>
          )}

          {!revealed ? (
            <div className="mt-5 space-y-3">
              {saveError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
              <Input
                ref={inputRef}
                aria-label="填写句子中缺少的单词"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                placeholder="填入这个词..."
                className="h-12 text-center text-lg"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="gap-1 text-xs text-zinc-500"
                  onClick={() => setShowHint(true)}
                  disabled={showHint}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  提示
                </Button>
                <Button className="flex-1" onClick={handleSubmit}>
                  提交
                </Button>
              </div>
              <p className="text-center text-[11px] text-zinc-400">
                想不起来直接提交也没关系，它会更早回到你面前
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  revealed.verdict === "correct"
                    ? "border border-green-200 bg-green-50 text-green-800"
                    : revealed.verdict === "close"
                    ? "border border-amber-200 bg-amber-50 text-amber-800"
                    : "border border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <p className="flex items-center gap-1.5 font-medium">
                  {revealed.verdict === "correct" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      记住了
                    </>
                  ) : revealed.verdict === "close" ? (
                    <>
                      <Badge className="bg-amber-200 text-[10px] text-amber-900 hover:bg-amber-200">
                        差一点
                      </Badge>
                      {revealed.note}
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      正确答案是 {revealed.expected}
                    </>
                  )}
                </p>
                {current!.translation && (
                  <p className="mt-1.5 text-zinc-600">{current!.translation}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/article?id=${current!.articleId}`}
                  className="text-xs text-zinc-400 hover:text-teal-600"
                >
                  查看原文
                </Link>
                <Button className="ml-auto gap-1" onClick={handleNext} autoFocus>
                  {index < questions.length - 1 ? "下一题" : "看结果"}
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
