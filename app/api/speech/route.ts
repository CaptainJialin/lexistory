import { NextRequest, NextResponse } from "next/server";
import WebSocket from "ws";

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

function synthesizeSentence(input: string): Promise<Buffer> {
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
      socket.removeAllListeners();
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    }

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
      if (!settled && audioChunks.length > 0) {
        finishWithAudio();
      }
    });

    socket.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString()) as DashScopeEvent;

        if (event.type === "response.audio.delta" && event.delta) {
          audioChunks.push(Buffer.from(event.delta, "base64"));
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
        socket.send(
          JSON.stringify({
            type: "session.update",
            session: {
              voice: "Cherry",
              response_format: "wav",
              mode: "server_commit",
            },
          })
        );

        socket.send(
          JSON.stringify({
            type: "input_text_buffer.append",
            text: input,
          })
        );

        socket.send(
          JSON.stringify({
            type: "session.finish",
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
    const { text } = (await request.json()) as { text?: string };
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

    const audio = await synthesizeSentence(input);
    const body = new Uint8Array(audio);

    return new NextResponse(body, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Speech generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
