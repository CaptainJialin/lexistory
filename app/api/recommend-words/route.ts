import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GradeOption, getGradeById } from "@/lib/types";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
});

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
  if (trimmed.startsWith("{")) return trimmed;
  return null;
}

function tryFixJson(text: string): string {
  let fixed = text;
  fixed = fixed.replace(/,\s*(\]|\})/g, "$1");
  fixed = fixed.replace(/,\s*\}/g, "}");
  fixed = fixed.replace(/"([^"]*?)\n([^"]*?)"/g, '"$1\\n$2"');
  fixed = fixed.replace(/"([^"]*?)\t([^"]*?)"/g, '"$1\\t$2"');
  return fixed;
}

function buildRecommendPrompt(grade: GradeOption): string {
  return `You are an expert English teacher designing a lesson for Chinese students.

TASK: Recommend a set of vocabulary words and grammar points appropriate for the following level:

- Grade: ${grade.name}
- CEFR: ${grade.cefr}
- Description: ${grade.description}

REQUIREMENTS:
1. Recommend 8-12 vocabulary words that are appropriate for ${grade.name} (${grade.cefr}) students.
2. Each word should be genuinely useful at this level — not too easy, not too obscure.
3. For each word, provide 1-3 common collocations or phrases (natural English collocations that students would encounter in real reading).
4. Recommend 2-3 grammar points that are most relevant and challenging for this level. Choose from common English grammar topics.
5. Each grammar point should have: a Chinese name, an English name, a category (e.g. 时态, 词法, 非谓语动词, 从句, 特殊句式), and a brief description with an example sentence in Chinese.

OUTPUT FORMAT (strict JSON):
{
  "words": [
    { "word": "abandon", "phrases": ["abandon hope", "abandon ship"] }
  ],
  "grammars": [
    {
      "id": "present-perfect",
      "name": "现在完成时",
      "nameEn": "Present Perfect Tense",
      "category": "时态",
      "description": "表示过去发生但对现在有影响的动作，如：I have lost my key.（我把钥匙弄丢了。）"
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting, no extra text.
- The "words" array should contain 8-12 items.
- The "grammars" array should contain 2-3 items.
- Choose words and grammars that form a coherent lesson — they should work well together in a reading passage.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gradeId } = body;

    if (!gradeId) {
      return NextResponse.json({ error: "Missing gradeId" }, { status: 400 });
    }

    const grade = getGradeById(gradeId);
    if (!grade) {
      return NextResponse.json({ error: "Invalid gradeId" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DeepSeek API key not configured" },
        { status: 500 }
      );
    }

    const prompt = buildRecommendPrompt(grade);

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.8,
      max_tokens: 4096,
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
    } catch (parseErr) {
      const fixed = tryFixJson(cleaned);
      try {
        result = JSON.parse(fixed);
      } catch {
        return NextResponse.json(
          { error: "AI returned malformed JSON" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recommend words error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
