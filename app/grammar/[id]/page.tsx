"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GRAMMAR_OPTIONS, PROFICIENCY_LABELS, type Article } from "@/lib/types";
import { getEntry, setGrammarProficiency } from "@/lib/grammarbook";
import { getArticles, getProgress } from "@/lib/storage";
import { buildLessonPlan } from "@/lib/lesson-plan";
import { generateArticleFromPlan } from "@/lib/generate-article";
import { describeDue, isDue } from "@/lib/srs";
import { useStoreVersion, useNow } from "@/lib/client-store";
import { PROFICIENCY_COLORS } from "@/lib/ui-constants";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Target,
  RefreshCw,
  Quote,
  BookOpen,
} from "lucide-react";

interface UsageExample {
  articleId: string;
  articleTitle: string;
  createdAt: number;
  sentences: string[];
}

export default function GrammarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const version = useStoreVersion();
  const now = useNow();
  const id = typeof params.id === "string" ? params.id : "";

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const option = useMemo(
    () => GRAMMAR_OPTIONS.find((g) => g.id === id),
    [id]
  );

  const entry = useMemo(
    () => (version < 0 ? undefined : getEntry(id)),
    [id, version]
  );

  /**
   * 反查：这个语法出现在你读过的哪些文章的哪些句子里。
   * 这是「学过的语法真的在文章里用上了」最直接的证据。
   */
  const examples = useMemo<UsageExample[]>(() => {
    if (version < 0 || !entry) return [];
    const articles = new Map<string, Article>(
      getArticles().map((a) => [a.id, a])
    );

    return entry.encounteredIn
      .map((enc) => {
        const article = articles.get(enc.articleId);
        if (!article || enc.sentences.length === 0) return null;
        return {
          articleId: enc.articleId,
          articleTitle: article.title,
          createdAt: article.createdAt,
          sentences: enc.sentences,
        };
      })
      .filter((e): e is UsageExample => e !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [entry, version]);

  const totalSentences = examples.reduce(
    (sum, e) => sum + e.sentences.length,
    0
  );

  async function handleGenerate() {
    setError("");
    setGenerating(true);
    try {
      const plan = buildLessonPlan({
        progress: getProgress(),
        focusGrammarId: id,
        mode: "grammar",
      });
      const article = await generateArticleFromPlan(plan);
      router.push(`/article?id=${article.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
      setGenerating(false);
    }
  }

  if (!option) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center lg:px-8">
        <p className="text-zinc-500">找不到这个语法点</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/grammar")}>
          返回语法本
        </Button>
      </main>
    );
  }

  const due = entry ? isDue(entry.srs, now) : false;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 lg:max-w-4xl lg:px-8">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.push("/grammar")}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        语法本
      </Button>

      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {option.category}
            </Badge>
            {entry ? (
              <Badge
                variant="outline"
                className={`text-xs ${PROFICIENCY_COLORS[entry.srs.proficiency]}`}
              >
                {PROFICIENCY_LABELS[entry.srs.proficiency]}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-zinc-400">
                尚未学习
              </Badge>
            )}
            {due && (
              <Badge className="bg-amber-100 text-xs text-amber-700 hover:bg-amber-100">
                <RefreshCw className="mr-1 h-3 w-3" />
                今日到期
              </Badge>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-bold text-zinc-900">{option.name}</h1>
          <p className="text-sm text-zinc-500">{option.nameEn}</p>

          <div className="mt-4 rounded-lg bg-teal-50/60 p-4">
            <h2 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-teal-800">
              <Sparkles className="h-4 w-4" />
              讲解
            </h2>
            <p className="text-sm leading-relaxed text-zinc-700">
              {option.description}
            </p>
          </div>

          {/* 掌握度自评 */}
          {entry && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-zinc-500">
                标记掌握度（会调整下次复现的时间）
              </p>
              <div className="flex gap-2">
                {PROFICIENCY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGrammarProficiency(id, idx)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      entry.srs.proficiency === idx
                        ? PROFICIENCY_COLORS[idx]
                        : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                在 {entry.encounteredIn.length} 篇文章中出现过 ·{" "}
                {describeDue(entry.srs, now)}复习
              </p>
            </div>
          )}

          <Separator className="my-6" />

          {/* 反查：这个语法在你读过的文章里的真实用例 */}
          <div>
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              <Quote className="h-4 w-4 text-emerald-600" />
              你读过的文章中的用例
            </h2>
            <p className="mb-3 text-xs text-zinc-500">
              {totalSentences > 0
                ? `共 ${totalSentences} 个句子，来自 ${examples.length} 篇文章`
                : "还没有用例——读一篇包含这个语法的文章后，原句会自动收集到这里"}
            </p>

            {examples.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center">
                <BookOpen className="mx-auto mb-2 h-7 w-7 text-zinc-300" />
                <p className="text-sm text-zinc-500">暂无用例</p>
              </div>
            ) : (
              <div className="space-y-3">
                {examples.map((ex) => (
                  <div
                    key={ex.articleId}
                    className="rounded-lg border border-zinc-200 bg-white p-3"
                  >
                    <Link
                      href={`/article?id=${ex.articleId}`}
                      className="flex items-center justify-between gap-2 text-xs text-zinc-500 hover:text-teal-600"
                    >
                      <span className="truncate font-medium">
                        {ex.articleTitle}
                      </span>
                      <span className="shrink-0">
                        {new Date(ex.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </Link>
                    <ul className="mt-2 space-y-1.5">
                      {ex.sentences.map((sentence, i) => (
                        <li
                          key={i}
                          className="border-l-2 border-emerald-200 pl-2.5 text-sm leading-relaxed text-zinc-700"
                        >
                          {sentence}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在生成文章...
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                用这个语法生成一篇文章
              </>
            )}
          </Button>
          <p className="mt-2 text-center text-xs text-zinc-400">
            会结合你当前的教材单元和到期复习的单词一起生成
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
