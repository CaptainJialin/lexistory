"use client";

import { useSyncExternalStore } from "react";

/**
 * localStorage 是一个外部数据源，用 useSyncExternalStore 订阅它。
 *
 * 这样组件既不用在 useEffect 里 setState（会触发级联渲染），
 * 又能在数据变化后自动刷新——例如在文章页标了掌握度，侧边栏的到期数会跟着变。
 * 服务端快照返回 -1，组件据此渲染空态，避免 hydration 不一致。
 */

let version = 0;
const listeners = new Set<() => void>();

/** 写入本地数据后调用，通知所有订阅者刷新 */
export function notifyDataChanged(): void {
  version++;
  listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  // 跨标签页同步
  const onStorage = (event: StorageEvent) => {
    if (event.key && !event.key.startsWith("lexistory_")) return;
    version++;
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => version;
const getServerSnapshot = () => -1;

/**
 * 返回本地数据的版本号。-1 表示还在服务端渲染或尚未水合，
 * 此时不要读 localStorage。
 */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 是否已在浏览器端水合完成 */
export function useIsHydrated(): boolean {
  return useStoreVersion() >= 0;
}

// ====== 当前时间 ======

/**
 * 「现在几点」同样是组件外部的可变状态，直接在渲染里调 Date.now()
 * 会让渲染变得不纯。这里按分钟粒度缓存，跨过零点时到期状态也能自动刷新。
 */
let cachedNow = Date.now();
const nowListeners = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;

function subscribeNow(onStoreChange: () => void): () => void {
  nowListeners.add(onStoreChange);
  if (nowTimer === null) {
    nowTimer = setInterval(() => {
      cachedNow = Date.now();
      nowListeners.forEach((listener) => listener());
    }, 60_000);
  }
  return () => {
    nowListeners.delete(onStoreChange);
    if (nowListeners.size === 0 && nowTimer !== null) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

const getNowSnapshot = () => cachedNow;
const getNowServerSnapshot = () => 0;

/** 当前时间戳（分钟粒度）。服务端返回 0。 */
export function useNow(): number {
  return useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot);
}
