"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  GRAMMAR_CATEGORIES,
  GRAMMAR_OPTIONS,
  PROFICIENCY_LABELS,
} from "@/lib/types";
import { getGrammarBookView, type GrammarBookView } from "@/lib/grammarbook";
import { isDue, describeDue } from "@/lib/srs";
import { useStoreVersion, useNow } from "@/lib/client-store";
import { PROFICIENCY_COLORS } from "@/lib/ui-constants";
import {
  Sparkles,
  ChevronRight,
  RefreshCw,
  BookOpen,
  Search,
  Circle,
} from "lucide-react";

type Filter = "all" | "due" | "learned" | "unlearned";

export default function GrammarBookPage() {
  const router = useRouter();
  const version = useStoreVersion();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const views = useMemo<GrammarBookView[]>(
    () => (version < 0 ? [] : getGrammarBookView()),
    [version]
  );

  const byId = useMemo(
    () => new Map(views.map((v) => [v.entry.grammarId, v])),
    [views]
  );

  const dueCount = views.filter((v) => isDue(v.entry.srs, now)).length;

  // 语法本里没有的语法点也列出来，让用户能主动去学
  const rows = useMemo(() => {
    return GRAMMAR_OPTIONS.map((option) => {
      const view = byId.get(option.id);
      return {
        option,
        view,
        learned: !!view,
        due: view ? isDue(view.entry.srs, now) : false,
      };
    }).filter((row) => {
      if (search) {
        const q = search.toLowerCase();
        const hit =
          row.option.name.includes(search) ||
          row.option.nameEn.toLowerCase().includes(q) ||
          row.option.description.includes(search);
        if (!hit) return false;
      }
      if (filter === "due") return row.due;
      if (filter === "learned") return row.learned;
      if (filter === "unlearned") return !row.learned;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byId, filter, search, version, now]);

  const stats = [
    { label: "已学语法", value: views.length, color: "text-zinc-900" },
    {
      label: "已掌握",
      value: views.filter((v) => v.entry.srs.proficiency >= 3).length,
      color: "text-green-600",
    },
    { label: "今日到期", value: dueCount, color: "text-amber-600" },
    {
      label: "未学习",
      value: GRAMMAR_OPTIONS.length - views.length,
      color: "text-zinc-400",
    },
  ];

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "due", label: `到期 ${dueCount}` },
    { key: "learned", label: "已学" },
    { key: "unlearned", label: "未学" },
  ];

  return (
    <main className="page-container entry-reveal">
      <p className="page-eyebrow mb-3">MAKE SENSE OF EVERY SENTENCE</p>
      <div className="mb-6">
        <h1 className="page-heading">
          我的语法本<span className="text-[#ae8856]">.</span>
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600">
          学过的语法会到期复现在新文章里。点开任意语法可以看到它在你读过的文章中的真实用例。
        </p>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <Card key={s.label} className="border-zinc-200">
            <CardContent className="px-2 py-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-zinc-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索语法点..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter === f.key
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="border-dashed border-zinc-300">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Sparkles className="mb-3 h-9 w-9 text-zinc-300" />
            <p className="text-sm text-zinc-600">没有符合条件的语法点</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {GRAMMAR_CATEGORIES.map((category) => {
            const inCategory = rows.filter(
              (r) => r.option.category === category
            );
            if (inCategory.length === 0) return null;

            return (
              <section key={category}>
                <h2 className="mb-2 text-xs font-semibold tracking-wide text-zinc-400">
                  {category}
                </h2>
                <div className="space-y-2">
                  {inCategory.map(({ option, view, learned, due }) => (
                    <Link key={option.id} href={`/grammar/${option.id}`} className="block rounded-2xl">
                      <Card
                        className={`cursor-pointer transition-shadow hover:shadow-sm ${
                          due
                            ? "border-amber-200 bg-amber-50/40"
                            : "border-zinc-200"
                        }`}
                      >
                        <CardContent className="flex items-center gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-zinc-900">
                                {option.name}
                              </span>
                              {learned ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    PROFICIENCY_COLORS[
                                      view!.entry.srs.proficiency
                                    ]
                                  }`}
                                >
                                  {PROFICIENCY_LABELS[view!.entry.srs.proficiency]}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-zinc-200 text-[10px] text-zinc-400"
                                >
                                  <Circle className="mr-1 h-2 w-2" />
                                  未学
                                </Badge>
                              )}
                              {due && (
                                <Badge className="bg-amber-100 text-[10px] text-amber-700 hover:bg-amber-100">
                                  <RefreshCw className="mr-0.5 h-2.5 w-2.5" />
                                  到期
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
                              {option.description}
                            </p>
                            {view && (
                              <p className="mt-1 text-[11px] text-zinc-400">
                                在 {view.encounterCount} 篇文章 ·{" "}
                                {view.sentenceCount} 个句子中出现过
                                {!due && ` · ${describeDue(view.entry.srs)}复习`}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Button
          variant="outline"
          className="w-full gap-1"
          onClick={() => router.push("/")}
        >
          <BookOpen className="h-4 w-4" />
          去生成今天的文章
        </Button>
      </div>
    </main>
  );
}
