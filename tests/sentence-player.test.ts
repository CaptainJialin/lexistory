import test from "node:test";
import assert from "node:assert/strict";
import { SentencePlayer, type SpeechEnvironment } from "../lib/sentence-player";

function setup(fetcher: typeof fetch = async () => new Response(new Blob(["audio"], { type: "audio/wav" }))) {
  const media: Array<{ plays: number; pauses: number; playbackRate: number; onended: (() => void) | null; onerror: (() => void) | null; play: () => Promise<void>; pause: () => void; removeAttribute: () => void; load: () => void }> = [];
  const utterances: SpeechSynthesisUtterance[] = [];
  const revoked: string[] = [];
  let requests = 0, urls = 0, pauses = 0, resumes = 0;
  const env: SpeechEnvironment = {
    fetch: async (...args) => { requests++; return fetcher(...args); },
    createURL: () => `blob:${++urls}`, revokeURL: (url) => { revoked.push(url); },
    audio: () => {
      const audio = { plays: 0, pauses: 0, playbackRate: 1, onended: null, onerror: null,
        async play() { this.plays++; }, pause() { this.pauses++; }, removeAttribute() {}, load() {} };
      media.push(audio); return audio as unknown as HTMLAudioElement;
    },
    utterance: (text) => ({ text } as SpeechSynthesisUtterance),
    synthesis: { cancel() {}, pause() { pauses++; }, resume() { resumes++; }, getVoices: () => [], speak(u: SpeechSynthesisUtterance) { utterances.push(u); u.onstart?.call(u, {} as SpeechSynthesisEvent); } } as unknown as SpeechSynthesis,
  };
  return { player: new SentencePlayer(() => env), media, utterances, revoked, counts: () => ({ requests, urls, pauses, resumes }) };
}

test("initialization and selection cleanup never fetch or play audio", () => {
  const fixture = setup(); fixture.player.stop();
  assert.equal(fixture.player.getSnapshot().status, "idle");
  assert.equal(fixture.counts().requests, 0); assert.equal(fixture.media.length, 0);
});

test("explicit play, pause and resume reuse the same audio and request", async () => {
  const f = setup(); await f.player.toggle("First sentence.");
  assert.equal(f.player.getSnapshot().status, "playing");
  await f.player.toggle("First sentence."); assert.equal(f.player.getSnapshot().status, "paused");
  await f.player.toggle("First sentence."); assert.equal(f.player.getSnapshot().status, "playing");
  assert.equal(f.counts().requests, 1); assert.equal(f.media[0].plays, 2);
  assert.equal(f.media[0].pauses, 1); f.player.dispose();
});

test("a late response after cancellation cannot play or create object URLs", async () => {
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | null | undefined;
  const f = setup(async (_url, options) => { signal = options?.signal; return new Promise((done) => { resolve = done; }); });
  const pending = f.player.play("Old sentence.");
  assert.equal(f.player.getSnapshot().status, "loading");
  f.player.stop(); assert.equal(signal?.aborted, true);
  resolve(new Response(new Blob(["audio"], { type: "audio/wav" }))); await pending;
  assert.equal(f.media.length, 0); assert.equal(f.counts().urls, 0); assert.equal(f.player.getSnapshot().status, "idle");
});

test("an old request cannot interrupt a new sentence", async () => {
  let resolve!: (response: Response) => void;
  let count = 0;
  const f = setup(async () => ++count === 1 ? new Promise((done) => { resolve = done; }) : new Response(new Blob(["new"], { type: "audio/wav" })));
  const old = f.player.play("Old"); await f.player.play("New");
  resolve(new Response(new Blob(["old"], { type: "audio/wav" }))); await old;
  assert.equal(f.media.length, 1); assert.equal(f.player.getSnapshot().text, "New"); f.player.dispose();
});

test("switching sentences stops audio and ignores stale ended events", async () => {
  const f = setup(); await f.player.play("One"); const oldEnd = f.media[0].onended;
  await f.player.play("Two"); oldEnd?.();
  assert.equal(f.media[0].pauses, 1); assert.equal(f.player.getSnapshot().status, "playing");
  assert.equal(f.player.getSnapshot().text, "Two"); f.player.dispose();
});

test("replay uses cached audio and supports a changed playback rate", async () => {
  const f = setup(); await f.player.play("Repeat"); f.media[0].onended?.();
  assert.equal(f.player.getSnapshot().status, "ended"); f.player.setRate(0.75); await f.player.play("Repeat");
  assert.equal(f.counts().requests, 1); assert.equal(f.media[1].playbackRate, 0.75); f.player.dispose();
  assert.deepEqual(f.revoked, ["blob:1"]);
});

test("device fallback supports pause/resume and avoids repeated missing-provider calls", async () => {
  const f = setup(async () => new Response(null, { status: 503 }));
  await f.player.play("Device"); assert.equal(f.player.getSnapshot().source, "device");
  await f.player.toggle("Device"); assert.equal(f.player.getSnapshot().status, "paused");
  await f.player.toggle("Device"); assert.equal(f.player.getSnapshot().status, "playing");
  assert.equal(f.counts().pauses, 1); await f.player.play("Another"); assert.equal(f.counts().requests, 1); f.player.dispose();
});

test("audio URL cache is bounded and disposal frees the remainder", async () => {
  const f = setup(); for (let i = 0; i < 23; i++) await f.player.play(`Sentence ${i}`);
  assert.equal(f.revoked.length, 3); f.player.dispose(); assert.equal(f.revoked.length, 23);
});
