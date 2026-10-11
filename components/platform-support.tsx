"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { captureInstallPrompt, clearInstallPrompt } from "@/lib/install-prompt";

export function PlatformSupport() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);
    try {
      const font = Number(localStorage.getItem("lexistory_reading_font"));
      if ([20, 23, 26].includes(font)) document.documentElement.style.setProperty("--reading-font-size", `${font}px`);
    } catch { /* Reading preferences are optional. */ }
    let disposed = false;
    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(async ({ App }) => {
        const listener = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back(); else void App.minimizeApp();
        });
        if (disposed) await listener.remove(); else remove = () => void listener.remove();
      });
    } else if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* Installation remains optional. */ });
    }
    return () => { disposed = true; remove?.(); window.removeEventListener("online", update); window.removeEventListener("offline", update); window.removeEventListener("beforeinstallprompt", captureInstallPrompt); window.removeEventListener("appinstalled", clearInstallPrompt); };
  }, []);
  if (!offline) return null;
  return <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs leading-6 text-amber-900">暂时离线，已保存的学习数据还在。<a href={Capacitor.isNativePlatform() ? "/history/" : "/offline.html"} className="ml-2 font-medium underline underline-offset-4">查看本机文章</a></div>;
}
