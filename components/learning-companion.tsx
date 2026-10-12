import Link from "next/link";
import { ArrowUpRight, BookOpen, Check, Languages, Leaf, PenLine, Target } from "lucide-react";
import type { DailyProgress } from "@/lib/daily-goal";

export function LearningCompanion({ daily, clozeCount, translateCount }: {
  daily: DailyProgress | null;
  clozeCount: { due: number; total: number };
  translateCount: number;
}) {
  const read = Math.min(daily?.articlesRead ?? 0, daily?.articleTarget ?? 1);
  const target = daily?.articleTarget ?? 1;
  const percent = daily?.percent ?? 0;

  return (
    <aside className="space-y-5" aria-label="学习目标与练习">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">今日小目标</h2><Target className="size-4 text-zinc-400" /></div>
        <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">给自己一篇文章的时间。</p>
        <div className="my-6 flex items-center gap-4">
          <div role="img" aria-label={`今日目标完成 ${percent}%`} className="flex size-20 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${percent}%, #edf1e7 0)` }}>
            <div className="flex size-[67px] flex-col items-center justify-center rounded-full bg-white"><span className="font-reading text-[25px] leading-none text-primary">{read}<span className="text-sm text-zinc-400"> / {target}</span></span><span className="mt-1 text-[9px] text-zinc-500">篇阅读</span></div>
          </div>
          <div><p className="text-xs font-medium text-zinc-700">{daily?.complete ? "今天又进步了一点" : "一点点，也很了不起"}</p><p className="mt-2 text-[11px] leading-5 text-zinc-500">{daily?.complete ? "让新学的知识慢慢沉淀，明天继续。" : "读完后点击「我读完了」，点亮今天的记录。"}</p></div>
        </div>
        <div className="space-y-3 border-t border-zinc-100 pt-4 text-xs">
          <div className="flex items-center gap-2 text-zinc-600">{daily?.complete ? <Check className="size-4 text-primary" /> : <BookOpen className="size-3.5 text-zinc-400" />}读一篇专属文章<span className="ml-auto text-[10px] text-zinc-400">{read}/{target}</span></div>
          {daily && daily.reviewTarget > 0 && <Link href="/review" className="flex items-center gap-2 text-zinc-600 hover:text-primary"><PenLine className="size-3.5 text-zinc-400" />温习熟悉的单词<span className="ml-auto text-[10px] text-zinc-400">{Math.min(daily.reviewsDone, daily.reviewTarget)}/{daily.reviewTarget}</span></Link>}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">换个方式，记得更牢</h2>
        <div className="mt-3 divide-y divide-zinc-100">
          {[{ href: "/review", icon: PenLine, label: "语境填空", description: clozeCount.total > 0 ? `${clozeCount.total} 个词可以练习` : "读过的句子，成为你的练习", tone: "bg-[#f2eee3] text-[#a08c57]" }, { href: "/practice/translate", icon: Languages, label: "长难句翻译", description: translateCount > 0 ? `${translateCount} 个长难句可以练习` : "从读懂，到用自己的话表达", tone: "bg-teal-50 text-primary" }].map((item) => (
            <Link key={item.href} href={item.href} className="group flex items-center gap-3 py-4">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}><item.icon className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-zinc-700 group-hover:text-primary">{item.label}</span><span className="mt-1 block text-[10px] leading-5 text-zinc-500">{item.description}</span></span><ArrowUpRight className="size-3.5 shrink-0 text-zinc-400 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      <div className="px-2 py-3"><Leaf className="mb-3 size-5 text-[#8e9b72]" strokeWidth={1.4} /><p className="font-reading text-xl leading-7 text-[#718062]">Progress, one<br /><span className="italic">story at a time.</span></p><p className="mt-3 text-[11px] leading-6 text-zinc-500">不必一次记住所有单词。<br />下一篇故事里，我们还会再见。</p></div>
    </aside>
  );
}
