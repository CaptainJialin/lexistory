"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { initialPlayback, SentencePlayer } from "./sentence-player";
import { apiFetch } from "./api-client";

export function useSentencePlayer() {
  const player = useMemo(() => new SentencePlayer(() => ({
    fetch: (path, options) => apiFetch(String(path), options),
    audio: (url) => new Audio(url),
    utterance: (text) => new SpeechSynthesisUtterance(text),
    synthesis: "speechSynthesis" in window ? window.speechSynthesis : undefined,
    createURL: URL.createObjectURL, revokeURL: URL.revokeObjectURL,
  })), []);
  const state = useSyncExternalStore(player.subscribe, player.getSnapshot, () => initialPlayback);
  useEffect(() => {
    try { player.setRate(Number(localStorage.getItem("lexistory_speech_rate") ?? 0.9)); } catch { /* Optional preference. */ }
    const onHidden = () => { if (document.hidden) player.pause(); };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      player.dispose();
    };
  }, [player]);
  return { player, state, setRate: (rate: number) => {
    player.setRate(rate);
    try { localStorage.setItem("lexistory_speech_rate", String(rate)); } catch { /* Playback still works. */ }
  } };
}
