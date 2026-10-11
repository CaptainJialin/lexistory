"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SentenceAnalysis,
  SentenceConstituent,
  GrammarOption,
  GRAMMAR_OPTIONS,
} from "@/lib/types";
import { isLongSentence, resolveGrammarId } from "@/lib/coverage";
import { extractMainClause } from "@/lib/sentence-analysis";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Scissors,
  Volume2,
  ExternalLink,
} from "lucide-react";

/** 渲染带成分标注的句子：每个片段下方挂一个标签 */
function AnnotatedSentence({
  sentence,
  constituents,
}: {
  sentence: string;
  constituents: SentenceConstituent[];
}) {
  const merged = useMemo(() => {
    const positioned = constituents
      .map((c) => {
        const start = sentence.indexOf(c.text);
        return start !== -1 ? { ...c, start, end: start + c.text.length } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.start - b.start);

    // 重叠时保留更长的那个
    const out: typeof positioned = [];
    for (const c of positioned) {
      const last = out[out.length - 1];
      if (last && c.start < last.end) {
        if (c.end - c.start > last.end - last.start) out[out.length - 1] = c;
      } else {
        out.push(c);
      }
    }
    return out;
  }, [sentence, constituents]);

  if (merged.length === 0) return <span>{sentence}</span>;

  const nodes: React.ReactNode[] = [];
  let lastEnd = 0;

  merged.forEach((c, i) => {
    if (c.start > lastEnd) {
      nodes.push(
        <span key={`gap-${i}`} className="inline-block align-bottom pb-[18px]">
          {sentence.slice(lastEnd, c.start)}
        </span>
      );
    }
    nodes.push(
      <span key={`c-${i}`} className="inline-block align-bottom mx-0.5">
        {/* 下划线让标签和它标注的片段有明确的从属关系 */}
        <span className="block border-b-2 border-teal-200 pb-0.5 text-sm leading-snug text-zinc-800">
          {c.text}
        </span>
        <span className="mt-0.5 block text-[10px] font-medium leading-tight text-teal-600">
          {c.label}
        </span>
      </span>
    );
    lastEnd = c.end;
  });

  if (lastEnd < sentence.length) {
    nodes.push(
      <span key="gap-end" className="inline-block align-bottom pb-[18px]">
        {sentence.slice(lastEnd)}
      </span>
    );
  }

  return <>{nodes}</>;
}

export function SentenceAnalysisPanel({
  analysis,
  articleGrammars,
  index,
  total,
  onPrev,
  onNext,
  onSpeak,
  onCollapse,
  onClose,
}: {
  analysis: SentenceAnalysis;
  articleGrammars: GrammarOption[];
  /** 当前是第几句（0-based），用于上一句/下一句 */
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSpeak: () => void;
  onCollapse: () => void;
  onClose: () => void;
}) {
  const main = useMemo(
    () => extractMainClause(analysis.sentence, analysis.constituents),
    [analysis]
  );

  const isLong = isLongSentence(analysis.sentence);

  return (
    <aside
      className={
        // 移动端：底部抽屉，限高可滚动——单句最多能有十几个区块，
        // 不限高的话最重要的原句和主干会被顶出屏幕
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col border-t bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)] " +
        // 桌面端：右侧栏，和正文并排——攻克长难句时需要对照原文位置
        "lg:inset-x-auto lg:right-0 lg:top-0 lg:h-screen lg:max-h-none lg:w-[400px] lg:border-l lg:border-t-0 lg:shadow-[-4px_0_20px_rgba(0,0,0,0.06)]"
      }
    >
      {/* 头部：固定，不随内容滚动 */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-teal-600" />
          <span className="text-sm font-semibold text-zinc-900">句子解析</span>
          {total > 1 && (
            <span className="shrink-0 text-xs text-zinc-400">
              {index + 1}/{total}
            </span>
          )}
          {isLong && (
            <Badge className="shrink-0 bg-purple-100 text-[10px] text-purple-700 hover:bg-purple-100">
              长难句
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onPrev}
            disabled={index <= 0}
            title="上一句"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onNext}
            disabled={index >= total - 1}
            title="下一句"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 lg:hidden"
            onClick={onCollapse}
            title="收起"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 内容：独立滚动 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* 原句 + 翻译 */}
        <div className="rounded-md bg-zinc-50 px-3 py-2">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm font-medium leading-relaxed text-zinc-800">
              {analysis.sentence}
            </p>
            <button
              type="button"
              onClick={onSpeak}
              className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700"
              title="朗读这句"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {analysis.translation && (
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
              {analysis.translation}
            </p>
          )}
        </div>

        {/*
          主干放在最前面。考研长难句的标准解法就是先剥掉修饰找主干——
          这一步做完，剩下的成分才知道该往哪儿挂。
        */}
        {main && (
          <section className="mt-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-purple-700">
              <Scissors className="h-3.5 w-3.5" />
              句子主干
              <span className="font-normal text-zinc-400">
                剥掉 {main.strippedWords} 个词的修饰
              </span>
            </h4>
            <div className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2">
              <p className="text-sm font-medium leading-relaxed text-purple-900">
                {main.text}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {main.stripped.map((c, i) => (
                  <span
                    key={i}
                    className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] text-purple-600"
                    title={c.text}
                  >
                    − {c.label}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 成分标注 */}
        {analysis.constituents && analysis.constituents.length > 0 && (
          <section className="mt-3">
            <h4 className="mb-1.5 text-xs font-semibold text-teal-700">
              成分拆解
            </h4>
            <div className="rounded-md bg-zinc-50 px-3 py-2.5 text-sm leading-loose">
              <AnnotatedSentence
                sentence={analysis.sentence}
                constituents={analysis.constituents}
              />
            </div>
          </section>
        )}

        {/* 难词 */}
        {analysis.difficultWords && analysis.difficultWords.length > 0 && (
          <section className="mt-3">
            <h4 className="mb-1.5 text-xs font-semibold text-teal-700">难词</h4>
            <div className="space-y-1.5">
              {analysis.difficultWords.map((dw, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md bg-amber-50 px-3 py-1.5"
                >
                  <span className="text-sm font-semibold text-amber-900">
                    {dw.originalForm || dw.word}
                  </span>
                  {dw.phonetic && (
                    <span className="font-mono text-xs text-zinc-500">
                      {dw.phonetic}
                    </span>
                  )}
                  {dw.partOfSpeech && (
                    <span className="text-xs text-amber-700">
                      {dw.partOfSpeech}
                    </span>
                  )}
                  <span className="text-sm text-zinc-700">{dw.meaning}</span>
                  {dw.morphologicalNote && (
                    <span className="text-[10px] text-zinc-400">
                      {dw.morphologicalNote}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 短语 */}
        {analysis.phrases && analysis.phrases.length > 0 && (
          <section className="mt-3">
            <h4 className="mb-1.5 text-xs font-semibold text-teal-700">短语</h4>
            <div className="space-y-1.5">
              {analysis.phrases.map((p, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-1.5"
                >
                  <code className="text-sm font-semibold text-emerald-800">
                    {p.phrase}
                  </code>
                  <span className="text-sm text-emerald-700">{p.meaning}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 语法：可以点进语法本看它在别的文章里的用例 */}
        {analysis.grammars && analysis.grammars.length > 0 && (
          <section className="mt-3">
            <h4 className="mb-1.5 text-xs font-semibold text-teal-700">语法</h4>
            <div className="space-y-1.5">
              {analysis.grammars.map((g, i) => {
                const id =
                  g.grammarId ?? resolveGrammarId(g.name, articleGrammars);
                const known = id && GRAMMAR_OPTIONS.some((o) => o.id === id);
                return (
                  <div
                    key={i}
                    className="rounded-md border border-teal-100 bg-teal-50/60 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-teal-800">
                        {g.name}
                      </span>
                      {known && (
                        <Link
                          href={`/grammar/${id}`}
                          className="flex shrink-0 items-center gap-0.5 text-[11px] text-teal-500 hover:text-teal-700"
                        >
                          更多用例
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed text-zinc-700">
                      {g.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 桌面端底部留白，免得最后一块贴着屏幕边 */}
        <div className="h-4" />
      </div>
    </aside>
  );
}
