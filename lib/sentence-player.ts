export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";
export interface PlaybackState {
  status: PlaybackStatus;
  text: string;
  rate: number;
  source: "cloud" | "device" | null;
  message: string;
}

export interface SpeechEnvironment {
  fetch: typeof fetch;
  audio: (url: string) => HTMLAudioElement;
  utterance: (text: string) => SpeechSynthesisUtterance;
  synthesis?: SpeechSynthesis;
  createURL: (blob: Blob) => string;
  revokeURL: (url: string) => void;
}

export const initialPlayback: PlaybackState = {
  status: "idle", text: "", rate: 0.9, source: null, message: "",
};

/** One owner for audio, requests and object URLs. Selection never calls play(). */
export class SentencePlayer {
  private state = initialPlayback;
  private listeners = new Set<() => void>();
  private generation = 0;
  private request?: AbortController;
  private media?: HTMLAudioElement;
  private utterance?: SpeechSynthesisUtterance;
  private cache = new Map<string, string>();
  private deviceOnly = false;

  constructor(private environment: () => SpeechEnvironment) {}

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(update: Partial<PlaybackState>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener());
  }

  stop = () => {
    this.generation++;
    this.request?.abort();
    this.request = undefined;
    if (this.media) {
      this.media.onended = this.media.onerror = null;
      this.media.pause();
      this.media.removeAttribute("src");
      this.media.load();
      this.media = undefined;
    }
    if (this.utterance) {
      this.utterance.onend = this.utterance.onerror = this.utterance.onstart = null;
      this.environment().synthesis?.cancel();
      this.utterance = undefined;
    }
    this.update({ status: "idle", text: "", source: null, message: "" });
  };

  pause = () => {
    if (this.state.status === "loading") { this.stop(); return; }
    if (this.state.status !== "playing") return;
    this.media?.pause();
    if (this.utterance) this.environment().synthesis?.pause();
    this.update({ status: "paused" });
  };

  setRate = (rate: number) => {
    if (![0.75, 0.9, 1, 1.25].includes(rate)) return;
    // SpeechSynthesis cannot reliably change a running utterance's rate.
    if (this.utterance) this.stop();
    if (this.media) this.media.playbackRate = rate;
    this.update({ rate });
  };

  toggle = async (text: string) => {
    if (this.state.text === text.trim()) {
      if (this.state.status === "playing" || this.state.status === "loading") {
        this.pause(); return;
      }
      if (this.state.status === "paused") {
        const token = this.generation;
        try {
          if (this.media) await this.media.play();
          else this.environment().synthesis?.resume();
          if (token === this.generation) this.update({ status: "playing" });
        } catch {
          if (token === this.generation) this.update({ status: "error", message: "播放被设备阻止，请再点一次播放。" });
        }
        return;
      }
    }
    await this.play(text);
  };

  play = async (text: string) => {
    this.stop();
    const sentence = text.trim();
    if (!sentence) return;
    const token = this.generation;
    const env = this.environment();
    this.update({ status: "loading", text: sentence, message: "" });
    if (this.deviceOnly) { this.playDevice(sentence, token); return; }
    const request = new AbortController();
    this.request = request;
    const timer = setTimeout(() => request.abort(), 25000);
    let url = this.cache.get(sentence);
    try {
      if (!url) {
        const response = await env.fetch("/api/speech", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sentence }), signal: request.signal,
        });
        if (!response.ok) {
          if (response.status === 503) this.deviceOnly = true;
          throw new Error("Speech unavailable");
        }
        const blob = await response.blob();
        if (token !== this.generation) return;
        if (!blob.size || !blob.type.startsWith("audio/")) throw new Error("Invalid audio");
        url = env.createURL(blob);
        this.cache.set(sentence, url);
        if (this.cache.size > 20) {
          const oldest = this.cache.keys().next().value!;
          env.revokeURL(this.cache.get(oldest)!);
          this.cache.delete(oldest);
        }
      }
    } catch {
      if (token === this.generation) this.playDevice(sentence, token);
      return;
    } finally { clearTimeout(timer); }
    if (token !== this.generation) return;
    const audio = env.audio(url);
    this.media = audio;
    audio.playbackRate = this.state.rate;
    audio.onended = () => {
      if (token === this.generation) this.update({ status: "ended" });
    };
    // Do not start another voice from onerror: play() may also reject.
    audio.onerror = () => {
      if (token === this.generation) this.update({ status: "error", message: "音频无法播放，请重试。" });
    };
    this.update({ source: "cloud" });
    try {
      await audio.play();
      if (token === this.generation) this.update({ status: "playing" });
    } catch {
      if (token === this.generation) this.update({ status: "error", message: "播放未开始，请再点一次播放。" });
    }
  };

  private playDevice(text: string, token: number) {
    const env = this.environment();
    if (!env.synthesis) {
      this.update({ status: "error", message: "当前设备没有可用语音，请联网后重试。" }); return;
    }
    const utterance = env.utterance(text);
    this.utterance = utterance;
    utterance.lang = "en-US";
    utterance.rate = this.state.rate;
    const voice = env.synthesis.getVoices().find((v) => v.lang === "en-US")
      ?? env.synthesis.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      if (token === this.generation) this.update({ status: "playing" });
    };
    utterance.onend = () => {
      if (token === this.generation) this.update({ status: "ended" });
    };
    utterance.onerror = () => {
      if (token === this.generation) this.update({ status: "error", message: "设备朗读未开始，请重试或检查系统英语语音。" });
    };
    this.update({ source: "device", message: "正在使用设备语音" });
    env.synthesis.cancel();
    env.synthesis.resume();
    env.synthesis.speak(utterance);
  }

  dispose = () => {
    this.stop();
    this.cache.forEach((url) => this.environment().revokeURL(url));
    this.cache.clear();
  };
}
