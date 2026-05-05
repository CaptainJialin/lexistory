"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Article, LEVEL_LABELS, getGradeById } from "@/lib/types";
import { getArticles, deleteArticle } from "@/lib/storage";
import { BookOpen, Trash2, Clock } from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    setArticles(getArticles());
  }, []);

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteArticle(id);
    setArticles(getArticles());
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">历史记录</h1>
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          <BookOpen className="mr-1 h-4 w-4" />
          去生成
        </Button>
      </div>

      {articles.length === 0 ? (
        <Card className="border-dashed border-zinc-300">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="mb-3 h-10 w-10 text-zinc-300" />
            <p className="text-zinc-600">还没有生成过文章</p>
            <Button className="mt-4" onClick={() => router.push("/")}>
              生成第一篇文章
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => {
            const grade = getGradeById(article.difficulty.gradeId);
            const difficultyLabel = grade
              ? `${LEVEL_LABELS[grade.level]}${grade.name} · ${grade.cefr}`
              : "未知难度";

            return (
              <Card
                key={article.id}
                className="cursor-pointer border-zinc-200 transition-shadow hover:shadow-sm"
                onClick={() => router.push(`/article?id=${article.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-1 text-xs text-zinc-500">
                        {new Date(article.createdAt).toLocaleString("zh-CN")}
                      </div>
                      <h2 className="text-lg font-semibold text-zinc-900">
                        {article.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {article.grammar.map((g) => (
                          <Badge key={g.id} variant="secondary" className="text-xs">
                            {g.name}
                          </Badge>
                        ))}
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
                          {difficultyLabel}
                        </Badge>
                        {article.words.slice(0, 5).map((w, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {w.word}
                          </Badge>
                        ))}
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
                      className="shrink-0 text-zinc-400 hover:text-red-600"
                      onClick={(e) => handleDelete(article.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
