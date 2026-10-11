"use client";

import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GRAMMAR_CATEGORIES, GRAMMAR_OPTIONS } from "@/lib/types";
import { getLearningStats, getProfile } from "@/lib/recommend";
import { getWordBook, getUpcomingDueCounts } from "@/lib/wordbook";
import { getGrammarBook } from "@/lib/grammarbook";
import { getArticles } from "@/lib/storage";
import { downloadBackup, importBackup, inspectBackup, undoLastImport, hasImportRecovery } from "@/lib/backup";
import { localDateKey } from "@/lib/calendar";
import { runMigrations } from "@/lib/migrate";
import { notifyDataChanged, useStoreVersion, useNow } from "@/lib/client-store";
import { DAY_MS, startOfDay } from "@/lib/srs";
import {
  Download,
  Upload,
  Flame,
  BookOpen,
  Library,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const HEATMAP_DAYS = 91; // 13 周

export default function StatsPage() {
  const version = useStoreVersion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [pendingImport, setPendingImport] = useState<{ json: string; articles: number; words: number } | null>(null);

  const now = useNow();

  const data = useMemo(() => {
    if (version < 0 || now === 0) return null;

    const stats = getLearningStats();
    const profile = getProfile();
    const wordBook = getWordBook();
    const grammarBook = getGrammarBook();
    const articles = getArticles();

    // 词汇量增长：按天累计入册数
    const growth: { date: string; total: number }[] = [];
    const sortedWords = [...wordBook].sort((a, b) => a.addedAt - b.addedAt);
    let running = 0;
    let cursor = 0;
    for (let i = 29; i >= 0; i--) {
      const dayEnd = startOfDay(now) + DAY_MS - i * DAY_MS;
      while (cursor < sortedWords.length && sortedWords[cursor].addedAt < dayEnd) {
        running++;
        cursor++;
      }
      growth.push({
        date: localDateKey(dayEnd - DAY_MS).slice(5, 10),
        total: running,
      });
    }

    // 阅读热力图：每天读了几篇
    const readsByDay = new Map<string, number>();
    for (const record of profile.history) {
      const key = localDateKey(record.readAt);
      readsByDay.set(key, (readsByDay.get(key) ?? 0) + 1);
    }
    const heatmap: { date: string; count: number }[] = [];
    for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
      const day = new Date(startOfDay(now) - i * DAY_MS);
      const key = localDateKey(day.getTime());
      heatmap.push({ date: key, count: readsByDay.get(key) ?? 0 });
    }

    // 语法分类覆盖
    const learnedIds = new Set(grammarBook.map((e) => e.grammarId));
    const byCategory = GRAMMAR_CATEGORIES.map((category) => {
      const all = GRAMMAR_OPTIONS.filter((g) => g.category === category);
      const learned = all.filter((g) => learnedIds.has(g.id));
      const mastered = learned.filter((g) => {
        const entry = grammarBook.find((e) => e.grammarId === g.id);
        return (entry?.srs.proficiency ?? 0) >= 3;
      });
      return {
        category,
        total: all.length,
        learned: learned.length,
        mastered: mastered.length,
      };
    });

    // 掌握度分布
    const distribution = [0, 1, 2, 3].map(
      (level) =>
        wordBook.filter(
          (e) => (e.srs?.proficiency ?? e.proficiency) === level
        ).length
    );

    return {
      stats,
      growth,
      heatmap,
      byCategory,
      distribution,
      upcoming: getUpcomingDueCounts(7, now),
      totalWords: wordBook.length,
      articleCount: articles.length,
    };
  }, [version, now]);

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setMessage("文件超过 20 MB，请检查备份。"); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = String(reader.result);
        const result = inspectBackup(json);
        setPendingImport({ json, articles: result.articles, words: result.words });
        setMessage("");
      } catch (error) { setMessage(error instanceof Error ? error.message : "备份无法读取。"); }
    };
    reader.onerror = () => setMessage("文件读取失败，请重新选择。");
    reader.readAsText(file);
    event.target.value = "";
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 text-center text-zinc-400 lg:px-8">
        加载中...
      </main>
    );
  }

  const { stats } = data;
  const maxGrowth = Math.max(1, ...data.growth.map((g) => g.total));
  const maxUpcoming = Math.max(1, ...data.upcoming.map((u) => u.count));

  const summary = [
    { icon: BookOpen, color: "text-teal-500", value: stats.totalArticles, label: "已读文章" },
    { icon: Library, color: "text-amber-500", value: stats.knownWords, label: "单词本" },
    { icon: Sparkles, color: "text-emerald-500", value: stats.knownGrammars, label: "语法本" },
    { icon: Flame, color: "text-red-500", value: stats.streakDays, label: "连续天数" },
  ];

  const distributionLabels = ["陌生", "认识", "熟悉", "掌握"];
  const distributionColors = [
    "bg-red-400",
    "bg-orange-400",
    "bg-teal-400",
    "bg-green-500",
  ];

  return (
    <main className="page-container entry-reveal">
      <p className="page-eyebrow mb-3">LITTLE BY LITTLE, A LITTLE BECOMES A LOT</p>
      <div className="mb-6">
        <h1 className="page-heading">
          看得见的进步<span className="text-[#ae8856]">.</span>
        </h1>
        <p className="page-intro">每一篇读过的文章，每一个记住的单词，都在这里留下痕迹。</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-zinc-200">
              <CardContent className="flex items-center gap-3 py-4">
                <Icon className={`h-5 w-5 ${s.color}`} />
                <div>
                  <p className="text-lg font-bold text-zinc-900">{s.value}</p>
                  <p className="text-xs text-zinc-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 词汇量增长 */}
      <Card className="mb-5 border-zinc-200">
        <CardContent className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-zinc-900">
            词汇量增长（近 30 天）
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            当前 {data.totalWords} 个词在单词本中
          </p>
          <div className="flex h-28 items-end gap-[2px]">
            {data.growth.map((g, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-teal-400/70 transition-colors hover:bg-teal-500"
                style={{ height: `${Math.max(2, (g.total / maxGrowth) * 100)}%` }}
                title={`${g.date}：${g.total} 词`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
            <span>{data.growth[0]?.date}</span>
            <span>{data.growth[data.growth.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>

      {/* 掌握度分布 + 未来到期 */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card className="border-zinc-200">
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">
              单词掌握度分布
            </h2>
            {data.totalWords === 0 ? (
              <p className="text-xs text-zinc-400">还没有单词</p>
            ) : (
              <div className="space-y-2">
                {data.distribution.map((count, level) => (
                  <div key={level} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-xs text-zinc-500">
                      {distributionLabels[level]}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-100">
                      <div
                        className={`h-full ${distributionColors[level]}`}
                        style={{
                          width: `${(count / data.totalWords) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs text-zinc-500">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardContent className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-zinc-900">
              未来 7 天复习量
            </h2>
            <p className="mb-3 text-xs text-zinc-500">
              今日到期 {stats.dueWords} 词
            </p>
            <div className="flex h-20 items-end gap-1.5">
              {data.upcoming.map((u, i) => (
                <div key={u.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t ${
                      i === 0 ? "bg-amber-400" : "bg-zinc-300"
                    }`}
                    style={{
                      height: `${Math.max(2, (u.count / maxUpcoming) * 100)}%`,
                    }}
                    title={`${u.date}：${u.count} 词`}
                  />
                  <span className="text-[9px] text-zinc-400">
                    {i === 0 ? "今" : `+${i}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 语法覆盖 */}
      <Card className="mb-5 border-zinc-200">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">
            语法覆盖（共 {GRAMMAR_OPTIONS.length} 个语法点）
          </h2>
          <div className="space-y-3">
            {data.byCategory.map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-700">{c.category}</span>
                  <span className="text-zinc-400">
                    {c.learned}/{c.total}
                    {c.mastered > 0 && ` · 掌握 ${c.mastered}`}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded bg-zinc-100">
                  <div
                    className="bg-green-500"
                    style={{ width: `${(c.mastered / c.total) * 100}%` }}
                  />
                  <div
                    className="bg-teal-400"
                    style={{
                      width: `${((c.learned - c.mastered) / c.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-3 text-[10px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-green-500" />已掌握
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-teal-400" />学习中
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-zinc-200" />未接触
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 阅读热力图 */}
      <Card className="mb-5 border-zinc-200">
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">
            阅读热力图（近 13 周）
          </h2>
          <div className="overflow-x-auto">
            <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
              {data.heatmap.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}：${d.count} 篇`}
                  className={`h-3 w-3 rounded-[2px] ${
                    d.count === 0
                      ? "bg-zinc-100"
                      : d.count === 1
                      ? "bg-green-200"
                      : d.count === 2
                      ? "bg-green-400"
                      : "bg-green-600"
                  }`}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据备份 */}
      <Card className="border-zinc-200">
        <CardContent className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            数据备份
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            所有学习数据都保存在这台设备的浏览器里。清理浏览器缓存会丢失数据，建议定期导出备份。
          </p>
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-2">
            {hasImportRecovery() && <Button variant="outline" size="sm" onClick={() => {
              const result = undoLastImport(); setMessage(result.message);
              if (result.ok) { runMigrations(); notifyDataChanged(); }
            }}>恢复上次导入前的数据</Button>}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void downloadBackup().catch(() => setMessage("备份未导出，请重试并选择保存位置。"))}>
              <Download className="h-4 w-4" />
              导出备份
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              导入备份
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
          {pendingImport && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">已验证备份：{pendingImport.articles} 篇文章 · {pendingImport.words} 个单词</p>
            <p className="mt-2 text-xs leading-6 text-amber-800">恢复后会替换这台设备上的学习数据。当前数据会保留一份恢复快照。</p>
            <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => {
              const result = importBackup(pendingImport.json); setMessage(result.message);
              if (result.ok) { runMigrations(); notifyDataChanged(); setPendingImport(null); }
            }}>确认恢复这份备份</Button><Button variant="outline" size="sm" onClick={() => setPendingImport(null)}>取消</Button></div>
          </div>}
          {message && (
            <Badge role="status" variant="secondary" className="mt-3 text-xs">
              {message}
            </Badge>
          )}
          <p className="mt-3 text-[11px] text-zinc-400">
            导入会覆盖当前数据，但会先自动留一份快照。
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
