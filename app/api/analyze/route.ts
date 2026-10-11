import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GrammarOption, GradeOption } from "@/lib/types";
import { buildAnalysisPrompt } from "@/lib/prompt";
import { parseLlmJson } from "@/lib/json-repair";

/**
 * 逐句解析。
 *
 * 从 /api/generate 拆出来的第二次调用。合在一起时输出经常超过
 * deepseek-chat 的 8192 token 上限，一截断整个 JSON 就废了。
 */

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
});

interface AnalyzeRequest {
  content: string;
  grammars: GrammarOption[];
  grade: GradeOption;
}

/**
 * 每个分片的目标词数。
 *
 * 一篇 540 词的文章有 30 句，每句都要翻译 + 成分 + 难词 + 音标 + 语法 + 短语，
 * 一次性分析仍会超 8192 token（实测丢掉最后 5 句）。切片后每片远低于上限，
 * 并发跑还能把耗时从 48 秒压下来。
 */
const CHUNK_WORDS = 150;

/** 按段落切分，段落过长时再按句子切，保证每片不超过 CHUNK_WORDS */
function splitIntoChunks(content: string): string[] {
  const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const paragraphs = content.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  const units: string[] = [];
  for (const paragraph of paragraphs) {
    if (countWords(paragraph) <= CHUNK_WORDS) {
      units.push(paragraph);
      continue;
    }
    // 超长段落按句子切，不能从句子中间断开
    const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [paragraph];
    let buffer = "";
    for (const sentence of sentences) {
      if (buffer && countWords(buffer + sentence) > CHUNK_WORDS) {
        units.push(buffer.trim());
        buffer = "";
      }
      buffer += sentence;
    }
    if (buffer.trim()) units.push(buffer.trim());
  }

  // 合并相邻小段，避免切得过碎浪费调用
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current && countWords(current + " " + unit) > CHUNK_WORDS) {
      chunks.push(current);
      current = unit;
    } else {
      current = current ? `${current}\n\n${unit}` : unit;
    }
  }
  if (current) chunks.push(current);

  return chunks.length > 0 ? chunks : [content];
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { content, grammars, grade } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DeepSeek API key not configured" },
        { status: 500 }
      );
    }

    const chunks = splitIntoChunks(content);

    // 并发分析各分片：既避开 token 上限，也把总耗时压到单片的量级
    const results = await Promise.allSettled(
      chunks.map(async (chunk) => {
        const completion = await openai.chat.completions.create({
          model: "deepseek-chat",
          temperature: 0.2, // 解析要稳定准确，不需要创造性
          max_tokens: 8192,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are an expert English teacher. You MUST respond with valid JSON only, no markdown formatting.",
            },
            {
              role: "user",
              content: buildAnalysisPrompt({
                content: chunk,
                grammars: grammars ?? [],
                grade,
              }),
            },
          ],
        });

        const raw = completion.choices[0]?.message?.content || "";
        if (!raw) return { sentences: [], repaired: false };

        const parsed = parseLlmJson<{ sentences?: unknown }>(raw);
        if (!parsed.ok) {
          console.error(
            `Analyze: 分片解析失败 (finish_reason=${completion.choices[0]?.finish_reason}, length=${raw.length})`
          );
          return { sentences: [], repaired: false };
        }

        return {
          sentences: Array.isArray(parsed.data?.sentences)
            ? parsed.data.sentences
            : [],
          repaired: parsed.repaired,
        };
      })
    );

    // 按分片顺序合并，保持句子在文中的先后
    const sentences: unknown[] = [];
    let repaired = false;
    let failedChunks = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        sentences.push(...result.value.sentences);
        if (result.value.repaired) repaired = true;
      } else {
        failedChunks++;
        console.error("Analyze: 分片请求失败", result.reason);
      }
    }

    if (sentences.length === 0) {
      return NextResponse.json(
        { error: "逐句解析生成失败" },
        { status: 500 }
      );
    }

    if (repaired || failedChunks > 0) {
      console.warn(
        `Analyze: ${chunks.length} 个分片，失败 ${failedChunks} 个，截断修复 ${repaired}，共保留 ${sentences.length} 句`
      );
    }

    return NextResponse.json({
      sentences,
      truncated: repaired || failedChunks > 0,
    });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
