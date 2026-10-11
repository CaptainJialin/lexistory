"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  WordBookEntry,
  PROFICIENCY_LABELS,
  WORD_PHRASES,
  type Article,
} from "@/lib/types";
import {
  getWordBook,
  removeWord,
  updateWordProficiency,
  updateWordMeaning,
  updateWordPhrases,
  addWord,
  addWords,
  clearWordBook,
  saveWordBook,
  getUpcomingDueCounts,
} from "@/lib/wordbook";
import { getArticles } from "@/lib/storage";
import { sentencesUsingWord } from "@/lib/coverage";
import { isDue, describeDue } from "@/lib/srs";
import { useStoreVersion, useNow } from "@/lib/client-store";
import { PROFICIENCY_COLORS } from "@/lib/ui-constants";
import {
  BookOpen,
  Trash2,
  Plus,
  X,
  Library,
  RefreshCw,
  Quote,
  ChevronDown,
  ChevronUp,
  Upload,
  Search,
} from "lucide-react";

type Filter = "all" | "due" | 0 | 1 | 2 | 3;

export default function WordBookPage() {
  const router = useRouter();
  const version = useStoreVersion();
  const now = useNow();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newPhrases, setNewPhrases] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMeaning, setEditMeaning] = useState("");
  const [editPhrases, setEditPhrases] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removedEntries, setRemovedEntries] = useState<WordBookEntry[]>([]);

  const entries = useMemo<WordBookEntry[]>(
    () => (version < 0 ? [] : getWordBook()),
    [version]
  );

  const articles = useMemo<Article[]>(
    () => (version < 0 ? [] : getArticles()),
    [version]
  );

  const dueCount = useMemo(
    () => entries.filter((e) => e.srs && isDue(e.srs, now)).length,
    [entries, now]
  );

  const upcoming = useMemo(
    () => (version < 0 || now === 0 ? [] : getUpcomingDueCounts(7, now)),
    [version, now]
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const proficiency = e.srs?.proficiency ?? e.proficiency;
      if (filter === "due" && !(e.srs && isDue(e.srs, now))) return false;
      if (typeof filter === "number" && proficiency !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.word.toLowerCase().includes(q) &&
          !(e.meaning && e.meaning.includes(search))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [entries, filter, search, now]);

  const stats = [
    { label: "总单词", value: entries.length, color: "text-zinc-900" },
    {
      label: "已掌握",
      value: entries.filter((e) => (e.srs?.proficiency ?? e.proficiency) === 3)
        .length,
      color: "text-green-600",
    },
    { label: "今日到期", value: dueCount, color: "text-amber-600" },
  ];

  function handleAdd() {
    if (!newWord.trim()) return;
    const phrases = newPhrases
      .split(/[,，\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    addWord({
      word: newWord.trim(),
      meaning: newMeaning.trim() || undefined,
      phrases:
        phrases.length > 0
          ? phrases
          : WORD_PHRASES[newWord.trim().toLowerCase()],
      source: "manual",
    });
    setNewWord("");
    setNewMeaning("");
    setNewPhrases("");
    setShowAddForm(false);
  }

  function handleBulkImport() {
    const words = bulkText
      .split(/[,，;；\n\r\t]+/)
      .map((s) => s.trim())
      .filter((s) => s && /[a-zA-Z]/.test(s));

    if (words.length === 0) {
      setBulkMessage("没有识别到单词");
      return;
    }

    const before = getWordBook().length;
    addWords(
      words.map((word) => ({
        word,
        phrases: WORD_PHRASES[word.toLowerCase()],
        source: "manual" as const,
      }))
    );
    const added = getWordBook().length - before;

    setBulkMessage(
      `识别 ${words.length} 个词，新增 ${added} 个${
        words.length - added > 0 ? `，${words.length - added} 个已存在` : ""
      }`
    );
    setBulkText("");
  }

  function startEdit(entry: WordBookEntry) {
    setEditingId(entry.id);
    setEditMeaning(entry.meaning || "");
    setEditPhrases(entry.phrases?.join(", ") || "");
  }

  function saveEdit(id: string) {
    updateWordMeaning(id, editMeaning);
    updateWordPhrases(
      id,
      editPhrases
        .split(/[,，\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
    setEditingId(null);
  }

  /** 反查：这个词出现在你读过的哪些文章的哪些原句里 */
  function getUsages(entry: WordBookEntry) {
    const ids = new Set(entry.seenIn ?? []);
    return articles
      .filter((a) => ids.has(a.id))
      .map((a) => ({
        article: a,
        sentences: sentencesUsingWord(a, entry.word),
      }))
      .filter((u) => u.sentences.length > 0);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "due", label: `到期 ${dueCount}` },
    ...PROFICIENCY_LABELS.map((label, idx) => ({
      key: idx as Filter,
      label,
    })),
  ];

  const maxUpcoming = Math.max(1, ...upcoming.map((u) => u.count));

  return (
    <main className="page-container entry-reveal">
      <p className="page-eyebrow mb-3">WORDS TO KEEP</p>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-heading">
            我的单词本<span className="text-[#ae8856]">.</span>
          </h1>
          <p className="page-intro">
            每一个积累的单词，都会在下一段故事里与你重逢。
          </p>
        </div>
        <Button size="sm" onClick={() => router.push("/")}>
          <BookOpen className="mr-1 h-4 w-4" />
          去生成文章
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-zinc-200">
            <CardContent className="py-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 未来 7 天复习量 */}
      {entries.length > 0 && (
        <Card className="mb-5 border-zinc-200">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-900">
                未来 7 天复习安排
              </p>
              {dueCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 border-amber-300 text-xs text-amber-700 hover:bg-amber-50"
                  onClick={() => router.push("/")}
                >
                  <RefreshCw className="h-3 w-3" />
                  生成复习文章
                </Button>
              )}
            </div>
            <div className="flex h-16 items-end gap-2">
              {upcoming.map((u, i) => (
                <div key={u.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-400">{u.count || ""}</span>
                  <div
                    className={`w-full rounded-t ${
                      i === 0 ? "bg-amber-400" : "bg-zinc-300"
                    }`}
                    style={{
                      height: `${Math.max(3, (u.count / maxUpcoming) * 100)}%`,
                    }}
                  />
                  <span className="text-[10px] text-zinc-400">
                    {i === 0 ? "今天" : `+${i}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选与搜索 */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="搜索单词或释义..."
              aria-label="搜索单词或释义"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            aria-label="批量导入单词"
            aria-expanded={showBulk}
            onClick={() => {
              setShowBulk(!showBulk);
              setShowAddForm(false);
            }}
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">批量导入</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label={showAddForm ? "关闭添加单词" : "添加单词"}
            aria-expanded={showAddForm}
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowBulk(false);
            }}
          >
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={String(f.key)}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "border-zinc-800 bg-zinc-800 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 批量导入 */}
      {showBulk && (
        <Card className="mb-4 border-zinc-200">
          <CardContent className="space-y-3 py-4">
            <label className="block text-xs font-medium text-zinc-700">
              粘贴单词列表（逗号、分号或换行分隔）
            </label>
            <Textarea
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setBulkMessage("");
              }}
              placeholder={"resilient, advocate, nuance\nephemeral\nubiquitous"}
              className="min-h-[110px] text-sm"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleBulkImport} disabled={!bulkText.trim()}>
                <Upload className="mr-1 h-3 w-3" />
                导入
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowBulk(false)}>
                取消
              </Button>
              {bulkMessage && (
                <span className="text-xs text-zinc-500">{bulkMessage}</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">
              导入的词会立即进入复习队列，在接下来的文章中优先出现。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 添加单个词 */}
      {showAddForm && (
        <Card className="mb-4 border-zinc-200">
          <CardContent className="space-y-3 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  单词
                </label>
                <Input
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="例如：challenge"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  中文释义
                </label>
                <Input
                  value={newMeaning}
                  onChange={(e) => setNewMeaning(e.target.value)}
                  placeholder="例如：n. 挑战"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                常用搭配（逗号分隔）
              </label>
              <Textarea
                value={newPhrases}
                onChange={(e) => setNewPhrases(e.target.value)}
                placeholder="例如：face a challenge, accept the challenge"
                className="min-h-[60px] resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>
                <Plus className="mr-1 h-3 w-3" />
                添加
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 单词列表 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-dashed border-zinc-300">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Library className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-zinc-600">
                {entries.length === 0 ? "单词本还是空的" : "没有匹配的单词"}
              </p>
              {entries.length === 0 && (
                <Button className="mt-4" onClick={() => setShowBulk(true)}>
                  批量导入生词
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((entry) => {
            const proficiency = entry.srs?.proficiency ?? entry.proficiency;
            const due = entry.srs ? isDue(entry.srs, now) : false;
            const expanded = expandedId === entry.id;
            const usages = expanded ? getUsages(entry) : [];

            return (
              <Card
                key={entry.id}
                className={due ? "border-amber-200 bg-amber-50/30" : "border-zinc-200"}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold text-zinc-900">
                          {entry.word}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${PROFICIENCY_COLORS[proficiency]}`}
                        >
                          {PROFICIENCY_LABELS[proficiency]}
                        </Badge>
                        {due && (
                          <Badge className="bg-amber-100 text-[10px] text-amber-700 hover:bg-amber-100">
                            <RefreshCw className="mr-0.5 h-2.5 w-2.5" />
                            到期
                          </Badge>
                        )}
                        <span className="text-xs text-zinc-400">
                          复习 {entry.reviewCount} 次
                          {entry.srs && !due && ` · ${describeDue(entry.srs, now)}`}
                        </span>
                      </div>

                      {editingId === entry.id ? (
                        <div className="mt-2 space-y-2">
                          <Input
                            value={editMeaning}
                            onChange={(e) => setEditMeaning(e.target.value)}
                            placeholder="中文释义"
                            className="h-8 text-sm"
                          />
                          <Textarea
                            value={editPhrases}
                            onChange={(e) => setEditPhrases(e.target.value)}
                            placeholder="常用搭配，逗号分隔"
                            className="min-h-[50px] resize-none text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => saveEdit(entry.id)}
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setEditingId(null)}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          {entry.meaning && (
                            <p className="text-sm text-zinc-600">{entry.meaning}</p>
                          )}
                          {entry.phrases && entry.phrases.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {entry.phrases.map((p, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[10px] font-normal text-zinc-500"
                                >
                                  {p}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {(entry.seenIn?.length ?? 0) > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedId(expanded ? null : entry.id)
                              }
                              className="mt-2 flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900"
                            >
                              <Quote className="h-3 w-3" />
                              在 {entry.seenIn!.length} 篇文章中出现过
                              {expanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {editingId !== entry.id && (
                        <>
                          <div className="flex gap-1">
                            {PROFICIENCY_LABELS.map((label, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => updateWordProficiency(entry.id, idx)}
                                className={`h-6 w-6 rounded-full text-[10px] font-bold transition-colors ${
                                  proficiency === idx
                                    ? PROFICIENCY_COLORS[idx].split(" ")[1]
                                    : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                                }`}
                                title={label}
                                aria-label={`将 ${entry.word} 标记为${label}`}
                                aria-pressed={proficiency === idx}
                              >
                                {idx + 1}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-zinc-500"
                              onClick={() => startEdit(entry)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-400 hover:text-red-600"
                              onClick={() => { setRemovedEntries([entry]); removeWord(entry.id); }}
                              aria-label={`删除单词 ${entry.word}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 原句反查 */}
                  {expanded && (
                    <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                      {usages.length === 0 ? (
                        <p className="text-xs text-zinc-400">
                          相关文章已被删除，找不到原句了
                        </p>
                      ) : (
                        usages.map(({ article, sentences }) => (
                          <div key={article.id}>
                            <Link
                              href={`/article?id=${article.id}`}
                              className="text-xs font-medium text-zinc-500 hover:text-teal-600"
                            >
                              {article.title}
                            </Link>
                            <ul className="mt-1 space-y-1">
                              {sentences.map((s, i) => (
                                <li
                                  key={i}
                                  className="border-l-2 border-emerald-200 pl-2.5 text-sm leading-relaxed text-zinc-700"
                                >
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {entries.length > 0 && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-red-600"
            onClick={() => {
              if (confirm("清空单词本？离开此页前可以撤销。建议先到学习统计导出备份。")) {
                setRemovedEntries(entries);
                clearWordBook();
              }
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            清空单词本
          </Button>
        </div>
      )}
      {removedEntries.length > 0 && <div role="status" className="sticky bottom-24 mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 lg:bottom-4"><span>已移除 {removedEntries.length} 个单词</span><Button variant="outline" size="sm" onClick={() => { const current = getWordBook(); const words = new Set(current.map((item) => item.word.toLowerCase())); saveWordBook([...current, ...removedEntries.filter((item) => !words.has(item.word.toLowerCase()))]); setRemovedEntries([]); }}>撤销删除</Button></div>}
    </main>
  );
}
