"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getArticles, deleteArticle, saveArticle } from "@/lib/storage";
import type { Article } from "@/lib/types";
import { getReadingProgress } from "@/lib/reading-progress";
import { notifyDataChanged, useStoreVersion } from "@/lib/client-store";
import { getArticleStudyLabel } from "@/lib/grade-resolver";
import Link from "next/link";
import { BookOpen, Trash2, Clock, RefreshCw, ArrowUpRight } from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();
  const version = useStoreVersion();
  const [deleted, setDeleted] = useState<Article | null>(null);
  const articles = useMemo(() => version < 0 ? [] : getArticles(), [version]);

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleted(articles.find((article) => article.id === id) ?? null);
    deleteArticle(id);
    notifyDataChanged();
  }

  return (
    <main className="page-container entry-reveal">
      <p className="page-eyebrow mb-3">YOUR PERSONAL LIBRARY</p>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="page-heading">读过的故事<span className="text-[#ae8856]">.</span></h1><p className="page-intro">翻回熟悉的篇章，总会有新的收获。</p></div>
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          <BookOpen className="mr-1 h-4 w-4" />
          开始新的阅读
        </Button>
      </div>

      {deleted && <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><span>已移除《{deleted.title}》</span><Button variant="outline" size="sm" onClick={() => { saveArticle(deleted); setDeleted(null); notifyDataChanged(); }}>撤销删除</Button></div>}

      {articles.length === 0 ? (
        <Card className="border-dashed border-zinc-300">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-teal-50"><Clock className="size-7 text-teal-400" strokeWidth={1.5} /></span>
            <p className="font-medium text-zinc-700">你的故事集，正等待第一篇</p>
            <p className="mt-2 text-xs leading-6 text-zinc-500">每次阅读都会保存在这里，随时回来温习。</p>
            <Button className="mt-4" onClick={() => router.push("/")}>
              生成第一篇文章
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {articles.map((article) => {
            const studyLabel = getArticleStudyLabel(article);

            return (
              <Card
                key={article.id}
                className="group relative border-zinc-200 transition-all hover:border-teal-300 hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-1 text-xs text-zinc-500">
                        <span className="mr-2 text-teal-700">{getReadingProgress(article.id)?.completedAt ? "已读完" : "待继续"}</span>
                        {new Date(article.createdAt).toLocaleString("zh-CN")}
                      </div>
                      <h2 className="mt-3 font-reading text-2xl leading-tight text-zinc-900">
                        <Link href={`/article?id=${article.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-primary">{article.title}</Link>
                      </h2>
                      <p className="mt-3 line-clamp-2 font-reading text-sm leading-6 text-zinc-500">{article.content}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {article.grammar.map((g) => (
                          <Badge key={g.id} variant="secondary" className="text-xs">
                            {g.name}
                          </Badge>
                        ))}
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
                          {studyLabel}
                        </Badge>
                        {article.words.slice(0, 5).map((w, idx) => {
                          const role = article.wordRoles?.[w.word.toLowerCase()];
                          return (
                            <Badge
                              key={idx}
                              variant="outline"
                              className={`text-xs font-normal ${
                                role === "review"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : ""
                              }`}
                            >
                              {role === "review" && (
                                <RefreshCw className="mr-0.5 h-2.5 w-2.5" />
                              )}
                              {w.word}
                            </Badge>
                          );
                        })}
                        {article.words.length > 5 && (
                          <span className="text-xs text-zinc-500">
                            +{article.words.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`删除文章 ${article.title}`}
                      className="relative z-10 shrink-0 text-zinc-400 hover:text-red-600"
                      onClick={(e) => handleDelete(article.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 text-[11px] text-zinc-500"><span>{article.words.length} 个目标词 · {article.grammar.length} 个语法点</span><span className="flex items-center gap-1 text-primary">继续阅读<ArrowUpRight className="size-3.5" /></span></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
