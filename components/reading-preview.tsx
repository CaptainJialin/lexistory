"use client";

import { useState } from "react";
import { ArrowUpRight, BookOpen, MousePointer2 } from "lucide-react";

const EXAMPLE_WORDS = {
  resilient: { phonetic: "/rɪˈzɪliənt/", meaning: "adj. 有韧性的；能迅速恢复的" },
  embrace: { phonetic: "/ɪmˈbreɪs/", meaning: "v. 欣然接受；拥抱" },
};

/** A clearly labeled example, independent of the learner's saved articles. */
export function ReadingPreview() {
  const [selected, setSelected] = useState<keyof typeof EXAMPLE_WORDS>("resilient");
  const word = EXAMPLE_WORDS[selected];

  function renderWord(value: keyof typeof EXAMPLE_WORDS) {
    return <button type="button" onClick={() => setSelected(value)} aria-pressed={selected === value}
      className={`rounded px-1 font-reading underline decoration-teal-300 decoration-2 underline-offset-4 transition-colors ${selected === value ? "bg-[#dce6cc] text-primary" : "hover:bg-[#e8eddd]"}`}>{value}</button>;
  }

  return (
    <div className="relative mt-9 pb-4 pr-3 sm:pr-6">
      <div aria-hidden="true" className="absolute inset-x-3 inset-y-2 rotate-2 rounded-2xl border border-[#dfdfcf] bg-[#eeeee2]" />
      <article className="reading-paper relative rounded-2xl border border-[#e0dfd1] p-6 shadow-[0_12px_28px_-20px_#404e443b] sm:p-8">
        <div className="mb-6 flex items-center justify-between text-[10px] tracking-wider text-[#8c8b73]">
          <span className="flex items-center gap-2"><BookOpen className="size-3.5" />阅读片段 · 示例</span><span>01 / A NEW BEGINNING</span>
        </div>
        <h2 className="font-reading text-[31px] leading-[1.15] tracking-tight text-[#3d4a35] sm:text-[35px]">Small steps.<br /><span className="italic text-[#748361]">Lasting change.</span></h2>
        <p className="mt-5 font-reading text-[17px] leading-[1.9] text-[#65705b]">
          A {renderWord("resilient")} mind grows a little every day. When we {renderWord("embrace")} small challenges, even an ordinary day becomes a new beginning.
        </p>
        <div className="mt-5 flex items-center gap-1.5 text-[10px] text-[#8c8b73]"><MousePointer2 className="size-3" />点击高亮单词，看看它的意思</div>
        <div aria-live="polite" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-[#dfe5d5] bg-white/80 p-4">
          <div><p className="text-sm font-semibold text-primary">{selected} <span className="ml-2 font-normal text-zinc-400">{word.phonetic}</span></p><p className="mt-1 text-xs leading-5 text-zinc-500">{word.meaning}</p></div>
          <ArrowUpRight className="size-4 shrink-0 text-teal-500" aria-hidden="true" />
        </div>
      </article>
    </div>
  );
}
