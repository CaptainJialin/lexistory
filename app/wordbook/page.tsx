"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  WordBookEntry,
  PROFICIENCY_LABELS,
  WORD_PHRASES,
} from "@/lib/types";
import {
  getWordBook,
  removeWord,
  updateWordProficiency,
  updateWordMeaning,
  updateWordPhrases,
  addWord,
  clearWordBook,
} from "@/lib/wordbook";
import {
  BookOpen,
  Trash2,
  ArrowLeft,
  Plus,
  X,
  Library,
  Brain,
} from "lucide-react";

const PROFICIENCY_COLORS = [
  "bg-red-50 text-red-700 border-red-200",
  "bg-orange-50 text-orange-700 border-orange-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-green-50 text-green-700 border-green-200",
];

export default function WordBookPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<WordBookEntry[]>([]);
  const [filterProficiency, setFilterProficiency] = useState<number | "all">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newPhrases, setNewPhrases] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMeaning, setEditMeaning] = useState("");
  const [editPhrases, setEditPhrases] = useState("");

  const loadEntries = useCallback(() => {
    setEntries(getWordBook());
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filtered = entries.filter((e) => {
    const matchProficiency =
      filterProficiency === "all" || e.proficiency === filterProficiency;
    const matchSearch =
      search === "" ||
      e.word.toLowerCase().includes(search.toLowerCase()) ||
      (e.meaning && e.meaning.includes(search));
    return matchProficiency && matchSearch;
  });

  const stats = [
    {
      label: "总单词",
      value: entries.length,
      color: "text-zinc-900",
    },
    {
      label: "已掌握",
      value: entries.filter((e) => e.proficiency === 3).length,
      color: "text-green-600",
    },
    {
      label: "需复习",
      value: entries.filter((e) => e.proficiency < 3).length,
      color: "text-orange-600",
    },
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
      phrases: phrases.length > 0 ? phrases : WORD_PHRASES[newWord.trim().toLowerCase()],
    });
    setNewWord("");
    setNewMeaning("");
    setNewPhrases("");
    setShowAddForm(false);
    loadEntries();
  }

  function handleDelete(id: string) {
    removeWord(id);
    loadEntries();
  }

  function handleSetProficiency(id: string, level: number) {
    updateWordProficiency(id, level);
    loadEntries();
  }

  function startEdit(entry: WordBookEntry) {
    setEditingId(entry.id);
    setEditMeaning(entry.meaning || "");
    setEditPhrases(entry.phrases?.join(", ") || "");
  }

  function saveEdit(id: string) {
    updateWordMeaning(id, editMeaning);
    const phrases = editPhrases
      .split(/[,，\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    updateWordPhrases(id, phrases);
    setEditingId(null);
    loadEntries();
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <h1 className="text-2xl font-bold text-zinc-900">我的单词本</h1>
        </div>
        <Button size="sm" onClick={() => router.push("/")}>
          <BookOpen className="mr-1 h-4 w-4" />
          去生成文章
        </Button>
      </div>

      {/* 统计 */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-zinc-200">
            <CardContent className="py-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 今日复习 */}
      {entries.filter((e) => e.proficiency < 3).length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/40">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  今日复习
                </p>
                <p className="text-xs text-zinc-500">
                  你有{" "}
                  <span className="font-bold text-amber-600">
                    {entries.filter((e) => e.proficiency < 3).length}
                  </span>{" "}
                  个单词需要巩固
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => router.push("/")}
              >
                <BookOpen className="h-3.5 w-3.5" />
                生成复习文章
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选与搜索 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterProficiency("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            filterProficiency === "all"
              ? "border-zinc-800 bg-zinc-800 text-white"
              : "border-zinc-200 bg-white text-zinc-600"
          }`}
        >
          全部
        </button>
        {PROFICIENCY_LABELS.map((label, idx) => (
          <button
            key={idx}
            onClick={() => setFilterProficiency(idx)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filterProficiency === idx
                ? "border-zinc-800 bg-zinc-800 text-white"
                : PROFICIENCY_COLORS[idx]
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Input
            placeholder="搜索单词..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-32 text-sm sm:w-40"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* 添加表单 */}
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddForm(false)}
              >
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
                <Button className="mt-4" onClick={() => setShowAddForm(true)}>
                  添加第一个单词
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((entry) => (
            <Card key={entry.id} className="border-zinc-200">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-zinc-900">
                        {entry.word}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${PROFICIENCY_COLORS[entry.proficiency]}`}
                      >
                        {PROFICIENCY_LABELS[entry.proficiency]}
                      </Badge>
                      <span className="text-xs text-zinc-400">
                        复习 {entry.reviewCount} 次
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
                          <p className="text-sm text-zinc-600">
                            {entry.meaning}
                          </p>
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
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {editingId !== entry.id && (
                      <>
                        <div className="flex gap-1">
                          {PROFICIENCY_LABELS.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                handleSetProficiency(entry.id, idx)
                              }
                              className={`h-6 w-6 rounded-full text-[10px] font-bold transition-colors ${
                                entry.proficiency === idx
                                  ? PROFICIENCY_COLORS[idx].split(" ")[1]
                                  : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                              }`}
                              title={PROFICIENCY_LABELS[idx]}
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
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {entries.length > 0 && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-red-600"
            onClick={() => {
              if (confirm("确定要清空单词本吗？此操作不可撤销。")) {
                clearWordBook();
                loadEntries();
              }
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            清空单词本
          </Button>
        </div>
      )}
    </main>
  );
}
