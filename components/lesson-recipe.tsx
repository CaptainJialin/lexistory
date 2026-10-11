"use client";

import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Info, Loader2, Plus, X } from "lucide-react";
import type { LessonPlan } from "@/lib/lesson-plan";

/**
 * 配方面板：生成之前就把「这篇文章由什么组成」摊开给用户看。
 * 新内容和到期复现的内容分色，这是「学过的东西真的回来了」的直接证据。
 */
export function LessonRecipe({
  plan,
  onToggleWord,
  compact = false,
  enriching = false,
}: {
  plan: LessonPlan;
  /** 传入则单词可点击移除 */
  onToggleWord?: (word: string) => void;
  compact?: boolean;
  /** 正在后台补全释义 */
  enriching?: boolean;
}) {
  const newWords = plan.words.filter((s) => s.role === "new");
  const reviewWords = plan.words.filter((s) => s.role === "review");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Sparkles className="size-3.5 text-teal-500" />
        <span className="font-medium text-zinc-900">本篇学习配方</span>
        <span className="ml-auto text-[10px] text-zinc-500">{newWords.length} 个新词 · {reviewWords.length} 个复习词 · {plan.grammars.length} 个语法点</span>
        {enriching && (
          <span className="flex items-center gap-1 text-xs text-zinc-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            补充释义中
          </span>
        )}
      </div>

      <div className={compact ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}>
        <WordGroup
          title="遇见新词"
          tone="new"
          slots={newWords}
          onToggleWord={onToggleWord}
          emptyHint="本篇没有新词"
        />
        <WordGroup
          title="温习旧词"
          tone="review"
          slots={reviewWords}
          onToggleWord={onToggleWord}
          emptyHint="新词会在未来的文章里与你重逢"
        />
      </div>

      {/* 语法 */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
        <p className="mb-2 text-xs font-medium text-zinc-500">语法点</p>
        <div className="flex flex-wrap gap-1.5">
          {plan.grammars.map((slot) => (
            <Badge
              key={slot.item.id}
              variant="outline"
              className={
                slot.role === "new"
                  ? "h-auto min-h-6 whitespace-normal border-teal-200 bg-teal-50 text-teal-700"
                  : "h-auto min-h-6 whitespace-normal border-amber-200 bg-amber-50 text-amber-700"
              }
              title={slot.reason}
            >
              {slot.role === "review" && (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              {slot.item.name}
            </Badge>
          ))}
        </div>
      </div>

      {plan.notes.length > 0 && (
        <div className="space-y-1 rounded-lg bg-zinc-50 px-3 py-2">
          {plan.notes.map((note, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-zinc-500">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function WordGroup({
  title,
  tone,
  slots,
  onToggleWord,
  emptyHint,
}: {
  title: string;
  tone: "new" | "review";
  slots: LessonPlan["words"];
  onToggleWord?: (word: string) => void;
  emptyHint: string;
}) {
  const toneClass =
    tone === "new"
      ? "border-teal-200/70 bg-teal-50 text-primary"
      : "border-[#e8dfc7] bg-[#f7f3e9] text-[#95804d]";

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
          {tone === "review" ? <RefreshCw className="size-3 text-[#a28d59]" /> : <Plus className="size-3 text-teal-500" />}
          {title}
        </p>
        <span className="text-[10px] text-zinc-400">{slots.length} 词</span>
      </div>

      {slots.length === 0 ? (
        <p className="py-2 text-[11px] leading-6 text-zinc-400">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            onToggleWord ? (
              <button key={slot.item.word} type="button" onClick={() => onToggleWord(slot.item.word)} aria-label={`从本篇移除 ${slot.item.word}`} title={`${slot.item.meaning ?? slot.reason} · 点击移除`} className={`group flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors hover:border-zinc-400 ${toneClass}`}>
                {slot.item.word}<X className="size-2.5 opacity-35 group-hover:opacity-100" />
              </button>
            ) : (
              <span key={slot.item.word} title={slot.item.meaning ?? slot.reason} className={`rounded-lg border px-2.5 py-1.5 text-xs ${toneClass}`}>{slot.item.word}</span>
            )
          ))}
        </div>
      )}
    </div>
  );
}
