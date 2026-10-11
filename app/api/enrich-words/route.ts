import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getGradeById } from "@/lib/types";

/**
 * 词义补全。
 *
 * 给定一批单词，返回中文义项、本次要练的目标义项、常用搭配和用法句型。
 * 这些数据喂给 lib/prompt.ts 的 <target meaning> / <usage patterns>，
 * 让模型按预期的那个意思去写，而不是随便挑一个同形词义。
 *
 * 由首页在后台调用，不阻塞生成——拿不到就按缺省流程走，
 * prompt 里已经要求模型自行选一个适龄义项并在 wordUsages 中说明。
 */

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
});

const MAX_WORDS = 30;

function extractJson(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim();
    if (inner.startsWith("{")) return inner;
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  const trimmed = text.trim();
  return trimmed.startsWith("{") ? trimmed : null;
}

function tryFixJson(text: string): string {
  return text
    .replace(/,\s*(\]|\})/g, "$1")
    .replace(/"([^"]*?)\n([^"]*?)"/g, '"$1\\n$2"')
    .replace(/"([^"]*?)\t([^"]*?)"/g, '"$1\\t$2"');
}

function buildEnrichPrompt(words: string[], gradeName: string, cefr: string): string {
  return `You are an expert English teacher preparing a reading lesson for Chinese students.

TASK: For each of the following words, provide the information a ${gradeName} (${cefr}) learner needs.

WORDS: ${words.join(", ")}

For EACH word provide:
1. "partOfSpeech" — the part of speech as used at this level, e.g. "noun", "verb", "adjective", "adverb".
2. "meanings" — 2-4 common Chinese senses of the word.
3. "targetMeaning" — ONE Chinese sense that is most appropriate and most useful at ${gradeName} level.
   The article will practise this exact sense, so avoid rare or literary senses.
4. "phrases" — 1-3 natural English collocations a learner would actually meet in real reading.
5. "usagePatterns" — 1-3 practical sentence frames or fixed expressions,
   e.g. "want to do sth", "be responsible for sth", "prevent sb from doing sth".

The targetMeaning, phrases and usagePatterns must fit together naturally and describe the SAME sense.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "words": [
    {
      "word": "preserve",
      "partOfSpeech": "verb",
      "meanings": ["保护，保存", "维持", "腌制"],
      "targetMeaning": "保护，保存",
      "phrases": ["preserve culture", "preserve the environment"],
      "usagePatterns": ["preserve sth from sth", "preserve sth for future generations"]
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON. Include EVERY word from the list, spelled exactly as given.
- Keep Chinese concise (no full sentences in "meanings" / "targetMeaning").`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawWords: unknown = body?.words;
    const gradeId: unknown = body?.gradeId;

    if (!Array.isArray(rawWords) || rawWords.length === 0) {
      return NextResponse.json({ error: "Missing words" }, { status: 400 });
    }

    const words = rawWords
      .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
      .map((w) => w.trim())
      .slice(0, MAX_WORDS);

    if (words.length === 0) {
      return NextResponse.json({ error: "No valid words" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DeepSeek API key not configured" },
        { status: 500 }
      );
    }

    const grade =
      typeof gradeId === "string" ? getGradeById(gradeId) : undefined;

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.3, // 释义要稳定，不需要创造性
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert English teacher. You MUST respond with valid JSON only, no markdown formatting.",
        },
        {
          role: "user",
          content: buildEnrichPrompt(
            words,
            grade?.name ?? "初中",
            grade?.cefr ?? "B1"
          ),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || "";
    if (!content) {
      return NextResponse.json(
        { error: "Empty response from DeepSeek" },
        { status: 500 }
      );
    }

    const cleaned = extractJson(content);
    if (!cleaned) {
      return NextResponse.json(
        { error: "Failed to extract JSON from AI response" },
        { status: 500 }
      );
    }

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      try {
        result = JSON.parse(tryFixJson(cleaned));
      } catch {
        return NextResponse.json(
          { error: "AI returned malformed JSON" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Enrich words error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
