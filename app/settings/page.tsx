"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { Smartphone, Download, BookOpen, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInstallPrompt, getServerInstallPrompt, subscribeInstallPrompt, clearInstallPrompt } from "@/lib/install-prompt";
import { useStoreVersion, notifyDataChanged } from "@/lib/client-store";

export default function SettingsPage() {
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, getServerInstallPrompt);
  const version = useStoreVersion();
  const installed = version >= 0 && (Capacitor.isNativePlatform() || window.matchMedia("(display-mode: standalone)").matches);
  let fontSize = 20;
  if (version >= 0) { try { const saved = Number(localStorage.getItem("lexistory_reading_font")); if ([20, 23, 26].includes(saved)) fontSize = saved; } catch { /* Optional preference. */ } }
  const [message, setMessage] = useState("");
  useEffect(() => {
    const onInstall = () => notifyDataChanged();
    window.addEventListener("appinstalled", onInstall);
    return () => window.removeEventListener("appinstalled", onInstall);
  }, []);
  return <main className="page-container entry-reveal">
    <p className="page-eyebrow mb-3">MAKE IT YOURS</p><h1 className="page-heading">你的阅读习惯<span className="text-[#ae8856]">.</span></h1><p className="page-intro mb-8">舒服一点，也更容易坚持一点。</p>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-6"><Smartphone className="mb-4 size-6 text-primary" /><h2 className="text-lg font-semibold">把学习放在手边</h2>
        <p className="mt-3 text-sm leading-7 text-zinc-500">{installed ? "你正在独立应用中使用 LexiStory。学习数据保存在当前设备。" : "将 LexiStory 添加到桌面，下次点图标就能回来。网站和手机都能使用。"}</p>
        {!installed && (prompt ? <Button className="mt-5 gap-2" onClick={async () => { try { await prompt.prompt(); const choice = await prompt.userChoice; setMessage(choice.outcome === "accepted" ? "安装请求已接受，稍后即可从桌面打开。" : "随时可以回来安装。"); clearInstallPrompt(); } catch { setMessage("请通过浏览器菜单添加到桌面。"); } }}><Download className="size-4" />安装到桌面</Button> : <div className="mt-4 rounded-xl bg-[#f4f6ef] p-4 text-sm leading-7 text-zinc-600"><p><b>iPhone / iPad</b>：用 Safari 打开，点「分享」→「添加到主屏幕」。</p><p className="mt-2"><b>Android / 电脑</b>：打开浏览器菜单，选择「安装应用」或「添加到主屏幕」。</p><p className="mt-2 text-xs text-zinc-500">若没有安装选项，可继续在浏览器使用全部学习功能。</p></div>)}
        {message && <p role="status" className="mt-3 text-sm text-primary">{message}</p>}
      </section>
      <section className="rounded-2xl border bg-white p-6"><BookOpen className="mb-4 size-6 text-primary" /><h2 className="text-lg font-semibold">让字更好读</h2><p className="mt-3 text-sm text-zinc-500">调整英文正文大小，设置会保存在这台设备。</p>
        <div className="mt-5 flex flex-wrap gap-2">{[{ value: 20, name: "舒适" }, { value: 23, name: "大字" }, { value: 26, name: "特大" }].map((size) => <Button key={size.value} variant={fontSize === size.value ? "default" : "outline"} aria-pressed={fontSize === size.value} onClick={() => { document.documentElement.style.setProperty("--reading-font-size", `${size.value}px`); try { localStorage.setItem("lexistory_reading_font", String(size.value)); notifyDataChanged(); } catch { setMessage("当前设备暂时无法保存偏好。"); } }}>{size.name}</Button>)}</div>
        <p className="mt-5 rounded-xl bg-[#fffefa] p-4 font-reading leading-relaxed text-zinc-700" style={{ fontSize }}>Every big change begins with a small step.</p>
        <p className="mt-4 text-xs leading-6 text-zinc-500">朗读默认关闭。在句子解析里点播放，再随时暂停或调整语速。</p>
      </section>
      <section className="rounded-2xl border bg-white p-6 xl:col-span-2"><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="text-lg font-semibold">把积累好好保存</h2></div><p className="mt-3 text-sm leading-7 text-zinc-500">文章、单词和学习记录保存在本机。目前不同设备之间需要通过导出、导入备份转移。卸载应用或清除网站数据前，记得先备份。</p><div className="mt-5 flex flex-wrap gap-4"><Link href="/stats" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">管理备份 <ArrowUpRight className="size-4" /></Link><Link href="/onboarding" className="text-sm text-zinc-600 underline underline-offset-4">重新选择学习起点</Link></div></section>
    </div>
  </main>;
}
