"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Article, QuizResult } from "@/lib/types";
import { saveQuizResult, recordUnitQuizOutcome } from "@/lib/storage";
import { applyQuizOutcome } from "@/lib/learning";
import { withLearningTransaction } from "@/lib/learning-transaction";
import { getQuizDraft, saveQuizDraft, clearQuizDraft, createQuizResult } from "@/lib/quiz-draft";
import { notifyDataChanged } from "@/lib/client-store";
import { QUIZ_TYPE_LABELS, stripOptionPrefix } from "@/lib/ui-constants";
import { countClozeAvailable } from "@/lib/cloze";
import { Trophy, Target, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
export function QuizPanel({ article, onComplete }: { article: Article; onComplete: () => boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => getQuizDraft(article));
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(Math.max(0, (draft?.answers.length ?? 0) - 1));
  const [selectedOption, setSelectedOption] = useState<number | null>(draft?.answers.at(-1) ?? null);
  const [showAnswer, setShowAnswer] = useState(Boolean(draft?.answers.length));
  const [answers, setAnswers] = useState<number[]>(draft?.answers ?? []);
  const [finished, setFinished] = useState(Boolean(draft?.result));
  const [finalResult, setFinalResult] = useState<QuizResult | null>(draft?.result ?? null);
  const [error, setError] = useState("");
  const confirmedRef = useRef(Boolean(draft?.answers.length));
  const finishedRef = useRef(Boolean(draft?.result));
  /** 交卷后才查，此时刚读过的词已经入册，数字才准 */
  const [clozeReady, setClozeReady] = useState(() => draft?.result ? countClozeAvailable().total : 0);

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
    if (selectedOption === null || confirmedRef.current) return;
    try {
      const next = [...answers, selectedOption];
      saveQuizDraft(article, next);
      confirmedRef.current = true;
      setAnswers(next); setShowAnswer(true); setError("");
    } catch {
      setError("这题还没能保存，可能是设备空间不足。请先导出备份，腾出空间后重新确认答案。");
    }
  }

  function handleNext() {
    if (!confirmedRef.current || finishedRef.current) return;
    if (currentIdx < total - 1) {
      confirmedRef.current = false;
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(null);
      setShowAnswer(false);
    } else {
      if (!onComplete()) return;
      try {
        const result = createQuizResult(article, answers);
        withLearningTransaction(() => {
          saveQuizResult(result);
          if (result.unitId) recordUnitQuizOutcome(result.unitId, result, result.score >= 80);
          applyQuizOutcome(article, answers, result);
          saveQuizDraft(article, answers, result);
        });
        finishedRef.current = true;
        setFinished(true); setFinalResult(result); setError("");
        setClozeReady(countClozeAvailable().total);
        notifyDataChanged();
      } catch {
        setError("成绩未能保存，答案仍然保留。请先导出备份、腾出空间，再点击查看结果重试。");
      }
    }
  }

  function handleRestart() {
    try { clearQuizDraft(article.id); } catch { setError("暂时无法开始新测验，请稍后重试。"); return; }
    confirmedRef.current = false; finishedRef.current = false;
    setDraft(null); setError("");
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
      <section aria-label="阅读小测" className="mt-6 rounded-2xl border border-teal-200/70 bg-[#eff5ee] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold text-zinc-900">读懂了多少，试一试</h3>
        </div>
        <p className="text-sm text-zinc-600 mb-4">
          {draft?.result ? `上次答对 ${draft.result.correctCount} / ${total} 题，结果已保存。` : draft?.answers.length ? `已保存 ${draft.answers.length} / ${total} 题，接着上次的进度继续。` : `${total} 道小题，帮你把故事里的知识留下来。`}
        </p>
        <p className="mb-4 text-xs leading-6 text-zinc-500">每次确认答案后自动保存，可以随时离开。当天重做只用于练习，不重复调整复习计划。</p>
        <Button onClick={() => setStarted(true)} className="gap-1">
          <Target className="h-4 w-4" />
          {draft?.result ? "查看上次结果" : draft?.answers.length ? "继续上次测验" : "开始阅读小测"}
        </Button>
      </section>
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
            {passed ? "这篇读得不错" : "再回看一遍，会更清楚"}
          </h3>
          <p className="mt-1 text-3xl font-bold text-indigo-600">
            {displayCorrect}/{total}
          </p>
          <p className="text-sm text-zinc-500">
            {passed
              ? "本次成绩已保存，继续保持这个节奏。"
              : "建议再练一次，错题会留在复习状态里。"}
          </p>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <details className="mt-5 rounded-xl border border-zinc-200 bg-white text-left">
            <summary className="cursor-pointer p-4 text-sm font-medium text-zinc-700">回看答案与解析</summary>
            <ol className="space-y-5 px-4 pb-4">
              {quizItems.map((question, index) => <li key={question.id} className="border-t border-zinc-100 pt-4 text-sm leading-6">
                <p className="font-medium">{index + 1}. {question.question}</p>
                <p className={answers[index] === question.correctIndex ? "mt-2 text-green-700" : "mt-2 text-red-700"}>你的答案：{String.fromCharCode(65 + answers[index])} · {stripOptionPrefix(question.options[answers[index]])}</p>
                {answers[index] !== question.correctIndex && <p className="text-green-700">正确答案：{String.fromCharCode(65 + question.correctIndex)} · {stripOptionPrefix(question.options[question.correctIndex])}</p>}
                <p className="mt-2 text-zinc-600">{question.explanation}</p>
              </li>)}
            </ol>
          </details>
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
          第 {currentIdx + 1} / {total} 题
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
              type="button"
              aria-pressed={selectedOption === idx}
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
          <p className="font-medium">{isCorrect ? "答对了" : "再看一下原文中的线索"}</p>
          <p className="mt-0.5 text-zinc-700">{currentQ.explanation}</p>
        </div>
      )}

      {/* Action buttons */}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500" role="status">{showAnswer ? `已保存 ${answers.length} / ${total} 题` : "确认后自动保存"}</span>
        {!showAnswer ? (
          <Button onClick={handleConfirm} disabled={selectedOption === null}>
            确认答案
          </Button>
        ) : (
          <Button onClick={handleNext}>
            {currentIdx < total - 1 ? "下一题" : "查看结果"}
          </Button>
        )}
      </div>
    </div>
  );
}
