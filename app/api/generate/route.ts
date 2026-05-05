import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { WordItem, GrammarOption, GradeOption, ArticleTheme, ArticleStyle } from "@/lib/types";
import { buildArticlePrompt } from "@/lib/prompt";

/**
 * Extract a JSON object string from LLM response text.
 * Handles markdown code blocks and plain text.
 */
function extractJson(text: string): string | null {
  // 1. Try to extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim();
    if (inner.startsWith("{")) return inner;
  }

  // 2. Find the outermost JSON object (first { to last })
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  // 3. Try parsing the whole trimmed text
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  return null;
}

/**
 * Attempt to fix common JSON syntax errors produced by LLMs.
 */
function tryFixJson(text: string): string {
  let fixed = text;

  // Remove trailing commas in arrays: [1, 2,] -> [1, 2]
  fixed = fixed.replace(/,\s*(\]|\})/g, "$1");

  // Remove trailing commas in objects: {"a": 1,} -> {"a": 1}
  fixed = fixed.replace(/,\s*\}/g, "}");

  // Fix unescaped newlines inside string values (aggressive but usually safe for LLM JSON)
  // This is a best-effort: replace literal newlines that appear between quotes
  fixed = fixed.replace(/"([^"]*?)\n([^"]*?)"/g, '"$1\\n$2"');

  // Fix unescaped tabs
  fixed = fixed.replace(/"([^"]*?)\t([^"]*?)"/g, '"$1\\t$2"');

  return fixed;
}

interface GenerateRequest {
  words: WordItem[];
  grammars: GrammarOption[];
  grade: GradeOption;
  theme?: ArticleTheme;
  style?: ArticleStyle;
}

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { words, grammars, grade, theme, style } = body;

    if (!words || words.length === 0 || !grammars || grammars.length === 0 || !grade) {
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

    const prompt = buildArticlePrompt(words, grammars, grade, theme, style);

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

    const content = completion.choices[0]?.message?.content || "";
    const finishReason = completion.choices[0]?.finish_reason;

    console.log("DeepSeek response length:", content.length, "finish_reason:", finishReason);

    if (!content) {
      return NextResponse.json(
        { error: "Empty response from DeepSeek" },
        { status: 500 }
      );
    }

    // Warn if truncated
    if (finishReason === "length") {
      console.error("WARNING: DeepSeek response was truncated due to length limit!");
    }

    // Parse JSON from DeepSeek's response (with robust fallback)
    const cleaned = extractJson(content);
    if (!cleaned) {
      console.error("Raw response preview:", content.slice(0, 500));
      return NextResponse.json(
        { error: "Failed to extract JSON from AI response" },
        { status: 500 }
      );
    }

    let article: unknown;
    try {
      article = JSON.parse(cleaned);
    } catch (parseErr) {
      // Try to fix common JSON syntax errors
      const fixed = tryFixJson(cleaned);
      try {
        article = JSON.parse(fixed);
      } catch {
        console.error("JSON parse failed. Error:", parseErr);
        console.error("Cleaned start:", cleaned.slice(0, 300));
        console.error("Cleaned end:", cleaned.slice(-300));
        return NextResponse.json(
          { error: "AI returned malformed JSON. Please try again." },
          { status: 500 }
        );
      }
    }
    return NextResponse.json(article);
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
