import { NextRequest, NextResponse } from "next/server";
import WebSocket from "ws";
import { readApiBody } from "@/lib/api-request";

export const runtime = "nodejs";

const DASHSCOPE_REALTIME_URL =
  "wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-tts-flash-realtime";

type DashScopeEvent = {
  type?: string;
  delta?: string;
  session?: { id?: string };
  error?: { code?: string; message?: string };
};

function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
}

function synthesizeSentence(input: string, signal: AbortSignal): Promise<Buffer> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("DashScope API key not configured"));
  }

  return new Promise((resolve, reject) => {
    const audioChunks: Buffer[] = [];
    let settled = false;

    const socket = new WebSocket(DASHSCOPE_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const timeout = setTimeout(() => {
      finishWithError(new Error("DashScope speech request timed out"));
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      socket.removeAllListeners();
      // Closing a CONNECTING socket emits an asynchronous error.
      socket.on("error", () => {});
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    }

    function onAbort() { finishWithError(new Error("Speech request cancelled")); }
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) { onAbort(); return; }

    function finishWithError(error: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    function finishWithAudio() {
      if (settled) return;
      settled = true;
      const audio = Buffer.concat(audioChunks);
      cleanup();
      if (audio.length === 0) {
        reject(new Error("DashScope returned empty audio"));
        return;
      }
      resolve(audio);
    }

    socket.on("error", (error) => finishWithError(error));
    socket.on("close", () => {
      if (!settled) finishWithError(new Error("Speech connection ended before completion"));
    });

    socket.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString()) as DashScopeEvent;

        if (event.type === "response.audio.delta" && event.delta) {
          audioChunks.push(Buffer.from(event.delta, "base64"));
          if (audioChunks.reduce((sum, chunk) => sum + chunk.length, 0) > 8 * 1024 * 1024) finishWithError(new Error("Audio exceeds limit"));
          return;
        }

        if (event.type === "session.finished") {
          finishWithAudio();
          return;
        }

        if (event.type === "error") {
          finishWithError(
            new Error(event.error?.message || "DashScope speech error")
          );
        }
      } catch (error) {
        finishWithError(
          error instanceof Error ? error : new Error("Invalid DashScope event")
        );
      }
    });

    waitForOpen(socket)
      .then(() => {
        if (settled) return;
        socket.send(
          JSON.stringify({
            type: "session.update",
            event_id: crypto.randomUUID(),
            session: {
              voice: "Cherry",
              response_format: "wav",
              language_type: "English",
              sample_rate: 24000,
              mode: "server_commit",
            },
          })
        );

        socket.send(
          JSON.stringify({
            type: "input_text_buffer.append",
            event_id: crypto.randomUUID(),
            text: input,
          })
        );

        socket.send(
          JSON.stringify({
            type: "session.finish",
            event_id: crypto.randomUUID(),
          })
        );
      })
      .catch((error) =>
        finishWithError(error instanceof Error ? error : new Error("Open failed"))
      );
  });
}

export async function POST(request: NextRequest) {
  try {
    const parsedRequest = await readApiBody(request, "speech");
    if (parsedRequest.error) return parsedRequest.error;
    const { text } = parsedRequest.body as { text: string };
    const input = text?.trim();

    if (!input) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    if (input.length > 1000) {
      return NextResponse.json(
        { error: "Text is too long for sentence playback" },
        { status: 400 }
      );
    }

    if (!process.env.DASHSCOPE_API_KEY) return NextResponse.json({ error: "云端语音未配置，将使用设备语音。" }, { status: 503 });
    const audio = await synthesizeSentence(input, request.signal);
    const body = new Uint8Array(audio);

    return new NextResponse(body, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error("Speech generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
