"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  BookOpen,
  Library,
  Sparkles,
  History,
  BarChart3,
  Flame,
  Home,
  PenLine,
  Languages,
  ArrowUpRight,
  ChevronRight,
  Menu,
  Leaf,
  ShieldCheck,
  Settings2,
} from "lucide-react";
import { getLearningStats } from "@/lib/recommend";
import { getProgress } from "@/lib/storage";
import { useStoreVersion } from "@/lib/client-store";
import { getAllBooks, getUnitById, getGradesByBook } from "@/lib/official-words";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  /** 移动端底栏是否展示 */
  primary?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "今日学习", icon: Home, primary: true },
  { href: "/review", label: "语境复习", icon: PenLine, primary: true },
  { href: "/practice/translate", label: "英译汉", icon: Languages },
  { href: "/wordbook", label: "单词本", icon: Library, primary: true },
  { href: "/grammar", label: "语法本", icon: Sparkles, primary: true },
  { href: "/history", label: "历史文章", icon: History },
  { href: "/stats", label: "学习统计", icon: BarChart3 },
  { href: "/settings", label: "偏好与安装", icon: Settings2 },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/** 侧边栏底部的当前进度胶囊 */
function ProgressPill() {
  const version = useStoreVersion();

  const label = useMemo(() => {
    if (version < 0) return null;
    const progress = getProgress();
    if (!progress) return null;
    const book = getAllBooks().find((b) => b.id === progress.bookId);
    const grade = getGradesByBook(progress.bookId).find(
      (g) => g.gradeId === progress.gradeId
    );
    const unit = getUnitById(progress.bookId, progress.gradeId, progress.unitId);
    if (!book || !unit) return null;
    return {
      book: `${book.name} · ${grade?.gradeName ?? ""}`,
      unit: unit.unitName,
    };
  }, [version]);

  if (!label) return null;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-3">
      <p className="mb-1 text-[10px] tracking-wider text-zinc-500">正在学习</p>
      <p className="mt-0.5 truncate text-xs font-medium text-zinc-700">
        {label.book}
      </p>
      <p className="truncate text-xs text-zinc-500">{label.unit}</p>
    </div>
  );
}

/** 到期数量徽标 */
function DueBadges() {
  const version = useStoreVersion();

  const due = useMemo(() => {
    if (version < 0) return { words: 0, grammars: 0, streak: 0 };
    const stats = getLearningStats();
    return {
      words: stats.dueWords,
      grammars: stats.dueGrammars,
      streak: stats.streakDays,
    };
  }, [version]);

  if (due.words === 0 && due.grammars === 0 && due.streak === 0) return null;

  return (
    <div className="space-y-1.5">
      {due.streak > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
          <Flame className="h-4 w-4 shrink-0 text-orange-500" />
          <span className="text-xs text-orange-700">
            连续学习 <b>{due.streak}</b> 天
          </span>
        </div>
      )}
      {(due.words > 0 || due.grammars > 0) && (
        <div className="rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-medium text-amber-800">今日到期</p>
          <p className="mt-0.5 text-xs text-amber-700">
            {due.words} 个单词
            {due.grammars > 0 && ` · ${due.grammars} 个语法`}
          </p>
        </div>
      )}
    </div>
  );
}

function Brand() {
    return (
      <Link href="/" className="flex items-center gap-3" aria-label="LexiStory 首页">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
          <BookOpen className="size-5" strokeWidth={1.6} />
        </span>
        <span>
          <span className="block font-reading text-[25px] font-semibold leading-none tracking-tight text-zinc-900">LexiStory<span className="text-[#ae8856]">.</span></span>
          <span className="mt-1.5 block text-[10px] tracking-[0.16em] text-zinc-500">在语境里，记住英语</span>
        </span>
      </Link>
    );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const primaryItems = NAV_ITEMS.filter((i) => i.primary);
  const currentPage = pathname === "/onboarding"
    ? "开启学习"
    : pathname === "/article"
    ? "阅读时光"
    : NAV_ITEMS.find((item) => isActive(pathname, item.href))?.label ?? "学习空间";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-primary px-4 py-3 text-white focus:not-sr-only">跳转到主要内容</a>
      <header className="sticky top-0 z-30 border-b bg-[#fdfdfa]/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <Brand />
          <details key={pathname} className="group relative">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 [&::-webkit-details-marker]:hidden" aria-label="更多导航">
              <Menu className="size-5" />
            </summary>
            <nav aria-label="更多导航" className="absolute right-0 top-12 w-48 rounded-2xl border bg-white p-2 shadow-xl">
              {NAV_ITEMS.filter((item) => !item.primary).map((item) => (
                <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-zinc-600 hover:bg-teal-50 hover:text-primary">
                  <item.icon className="size-4" />{item.label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </header>

      <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col overflow-y-auto border-r border-zinc-200/80 bg-[#fdfdfa] lg:flex xl:w-[256px]">
        <div className="px-6 pb-10 pt-8">
          <Brand />
        </div>

        <nav aria-label="主导航" className="flex-1 space-y-1 px-4">
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <div key={item.href}>
                {(index === 0 || index === 3) && <p className={`px-3 pb-3 text-[10px] tracking-[0.14em] text-zinc-400 ${index === 3 ? "pt-7" : ""}`}>{index === 0 ? "学习空间" : "我的积累"}</p>}
                <Link href={item.href} aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] transition-colors ${active ? "bg-teal-100/75 font-semibold text-primary" : "text-zinc-500 hover:bg-zinc-100/70 hover:text-zinc-900"}`}>
                  <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2 : 1.65} />
                  {item.label}
                  {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="space-y-3 px-4 pb-5 pt-6">
          <DueBadges />
          <ProgressPill />
          <div className="rounded-2xl bg-[#f1f2e8] p-4 [@media(max-height:850px)]:hidden">
            <Leaf className="mb-3 size-5 text-[#788764]" strokeWidth={1.5} />
            <p className="font-reading text-base leading-6 text-zinc-700">A little every day,<br />a long way over time.</p>
            <p className="mt-2 text-[11px] text-zinc-500">每天一点，走得更远。</p>
          </div>
          <Link href="/stats" className="flex items-center gap-2 px-2 pt-2 text-[10px] text-zinc-500 hover:text-primary">
            <ShieldCheck className="size-3.5" />学习数据保存在本机<ArrowUpRight className="ml-auto size-3" />
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="hidden h-[76px] shrink-0 items-center justify-between border-b border-zinc-200/70 px-10 lg:flex">
          <div className="flex items-center gap-2.5 text-xs text-zinc-400"><span>我的学习空间</span><ChevronRight className="size-3" /><span className="font-medium text-zinc-700">{currentPage}</span></div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500"><span className="size-1.5 rounded-full bg-teal-400" />每天一篇，让英语自然发生</div>
        </header>
        <div id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">{children}</div>
      </div>

      <nav aria-label="底部导航" className="fixed bottom-0 left-0 right-0 z-30 border-t bg-[#fdfdfa]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="flex px-2">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] transition-colors ${
                  active ? "font-semibold text-primary" : "text-zinc-500"
                }`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-lg ${active ? "bg-teal-100" : ""}`}><Icon className="size-[18px]" /></span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
