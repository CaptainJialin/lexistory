"use client";

import Link from "next/link";
import { ArrowUpRight, Bookmark } from "lucide-react";
import { useStoreVersion } from "@/lib/client-store";
import { getContinueReading } from "@/lib/reading-progress";

export function ContinueReading() {
  const version = useStoreVersion();
  const item = version >= 0 ? getContinueReading() : null;
  if (!item) return null;
  return <Link href={`/article?id=${encodeURIComponent(item.article.id)}`} className="mb-6 flex items-center gap-4 rounded-2xl border border-teal-200 bg-[#eef4e8] p-5 transition-colors hover:bg-[#e5efdc]">
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700"><Bookmark className="size-5" /></span>
    <div className="min-w-0 flex-1"><p className="text-xs font-medium text-teal-700">接着上次的故事</p><p className="mt-1 truncate font-reading text-xl text-teal-950">{item.article.title}</p><p className="mt-1 text-xs text-teal-700">{item.progress?.sentenceIndex !== undefined ? `上次看到第 ${item.progress.sentenceIndex + 1} 句` : "还没读完，随时可以继续"}</p></div>
    <ArrowUpRight className="size-5 shrink-0 text-teal-700" />
  </Link>;
}
