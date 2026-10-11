import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  WordItem,
  GrammarOption,
  GradeOption,
  ArticleTheme,
  ArticleStyle,
  LessonRole,
} from "@/lib/types";
import { buildArticlePrompt } from "@/lib/prompt";
import { parseLlmJson } from "@/lib/json-repair";

/**
 * 文章生成。
 *
 * 逐句解析已拆到 /api/analyze——两者合在一起输出经常超过 deepseek-chat 的
 * 8192 token 上限，一截断整个 JSON 就解析不了，用户等一分钟只拿到报错。
 */

interface GenerateRequest {
  words: WordItem[];
  grammars: GrammarOption[];
  grade: GradeOption;
  theme?: ArticleTheme;
  style?: ArticleStyle;
  /** 每个词/语法是新学还是到期复习，决定 prompt 里的写作要求 */
  wordRoles?: Record<string, LessonRole>;
  grammarRoles?: Record<string, LessonRole>;
}

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { words, grammars, grade, theme, style, wordRoles, grammarRoles } = body;

    if (!words?.length || !grammars?.length || !grade) {
      return NextResponse.json(
        { error: "Missing words, grammar, or grade selection" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DeepSeek API key not configured" },
        { status: 500 }
      );
    }

    const prompt = buildArticlePrompt({
      words,
      grammars,
      grade,
      theme,
      style,
      wordRoles,
      grammarRoles,
    });

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert English teacher. You MUST respond with valid JSON only, no markdown formatting.",
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content || "";
    const finishReason = completion.choices[0]?.finish_reason;

    if (!raw) {
      return NextResponse.json(
        { error: "Empty response from DeepSeek" },
        { status: 500 }
      );
    }

    const parsed = parseLlmJson<Record<string, unknown>>(raw);

    if (!parsed.ok) {
      console.error(
        `Generate: JSON 解析失败 (finish_reason=${finishReason}, length=${raw.length})`,
        raw.slice(0, 300)
      );
      return NextResponse.json(
        { error: "AI 返回的内容无法解析，请重试" },
        { status: 500 }
      );
    }

    const article = parsed.data ?? {};

    // 修复能救回结构，但正文缺失就没有意义了
    if (typeof article.content !== "string" || !article.content.trim()) {
      console.error(
        `Generate: 响应缺少正文 (finish_reason=${finishReason}, repaired=${parsed.repaired})`
      );
      return NextResponse.json(
        { error: "AI 没有返回文章正文，请重试" },
        { status: 500 }
      );
    }

    if (parsed.repaired) {
      console.warn(
        `Generate: 响应被截断，已修复保留正文（finish_reason=${finishReason}）`
      );
    }

    return NextResponse.json({ ...article, truncated: parsed.repaired });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
