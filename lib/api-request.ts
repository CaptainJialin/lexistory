import { NextResponse } from "next/server";

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const grammars = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every((g) => isObject(g) && text(g.id, 80) && text(g.name, 150));
const grade = (value: unknown) => isObject(value) && text(value.id, 30) && text(value.level, 30);

export function validApiBody(kind: string, body: unknown): body is Record<string, unknown> {
  if (!isObject(body)) return false;
  switch (kind) {
    case "speech": return text(body.text, 1000);
    case "generate": return Array.isArray(body.words) && body.words.length > 0 && body.words.length <= 60 && body.words.every((w) => isObject(w) && text(w.word, 100)) && Array.isArray(body.grammars) && grammars(body.grammars) && body.grammars.length > 0 && grade(body.grade);
    case "analyze": return text(body.content, 20000) && grammars(body.grammars) && grade(body.grade);
    case "enrich-words": return Array.isArray(body.words) && body.words.length > 0 && body.words.length <= 60 && body.words.every((w) => text(w, 100)) && text(body.gradeId, 30);
    case "grade-translation": return text(body.sentence, 3000) && text(body.reference, 6000) && text(body.input, 6000);
    default: return false;
  }
}

export async function readApiBody(request: Request, kind: string) {
  const error = (message: string, status: number) => ({ body: null, error: NextResponse.json({ error: message }, { status }) });
  if (!request.headers.get("content-type")?.includes("application/json")) return error("请使用 JSON 格式提交请求。", 415);
  const limit = 96 * 1024;
  if (Number(request.headers.get("content-length")) > limit) return error("请求内容过长，请减少词汇或文本。", 413);
  const reader = request.body?.getReader();
  if (!reader) return error("请求内容为空。", 400);
  let bytes = 0;
  const decoder = new TextDecoder();
  let raw = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); return error("请求内容过长。", 413); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const body: unknown = JSON.parse(raw);
    if (!validApiBody(kind, body)) return error("提交的内容不完整或格式不正确，请检查后重试。", 400);
    return { body, error: null };
  } catch { return error("请求无法读取，请检查输入后重试。", 400); }
}
