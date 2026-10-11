import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readApiBody } from "@/lib/api-request";
import { parseLlmJson } from "@/lib/json-repair";

/**
 * 英译汉评分。
 *
 * 要点是**给出具体问题**，不是空泛夸奖。考研翻译的失分点很集中：
 * 长难句结构没理清、定语从句译成流水账、被动语态硬译、词义选错。
 * 反馈必须落到这些点上，否则练了等于没练。
 */

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY || "",
});

interface GradeRequest {
  sentence: string;
  reference: string;
  input: string;
}

function buildPrompt(req: GradeRequest): string {
  return `You are a 考研英语 teacher grading a student's English-to-Chinese translation.

ORIGINAL ENGLISH SENTENCE:
${req.sentence}

REFERENCE TRANSLATION (one acceptable version, not the only correct answer):
${req.reference}

STUDENT'S TRANSLATION:
${req.input}

TASK: Grade it the way 考研英语一 翻译题 is graded (10分制按点给分).

Judge on three things:
1. 准确性 — did they get the meaning right? Wrong word sense, misread structure, reversed logic?
2. 完整性 — did they drop any information? Missing modifiers, clauses, or qualifiers?
3. 通顺度 — is it natural Chinese, or word-for-word translationese?

OUTPUT FORMAT (strict JSON, no markdown):
{
  "score": 7,
  "accuracy": 3,
  "completeness": 2,
  "fluency": 2,
  "verdict": "一句话总评",
  "issues": [
    { "type": "准确性 / 完整性 / 通顺度 之一", "detail": "具体指出哪个词或哪个结构处理得不对，以及应该怎样" }
  ],
  "strengths": ["做得好的地方，1-2 条，没有就给空数组"],
  "betterVersion": "一个更好的译法"
}

RULES:
- "score" is 0-10. accuracy 0-4, completeness 0-3, fluency 0-3. They must add up to score.
- Be honest. If the translation is wrong or empty, give a low score and say why.
  Do NOT be encouraging at the expense of accuracy — a student who gets praised for a
  bad translation learns nothing.

- CONTRADICTION IS THE MOST SEVERE ERROR. Before anything else, check whether the student
  reversed or contradicted the original meaning:
    * a concessive clause (although/though) rendered as causal (因为/由于), or vice versa
    * a word rendered as its opposite (exaggerated → 低估, rapidly → 缓慢, uneven → 均匀)
    * a negation added or dropped
    * cause and effect swapped
  If ANY of these happened, you MUST:
    - set accuracy to at most 1, and total score to at most 3
    - name it in "issues" with type "准确性" and say explicitly 「译反了」/「逻辑相反」,
      quoting both what the original says and what the student wrote
  Do NOT describe a contradiction as a mere omission ("遗漏了…") — the student would then
  think they simply left something out, and would never notice they understood it backwards.
  This is the single most important thing you check.

- "issues": at most 3, each pointing at a SPECIFIC word or structure in their translation.
  Empty array only if the translation is genuinely near-perfect.
- The reference is only one acceptable version. Do not penalize a different but equally
  correct rendering. Judge meaning, not wording match.
- All feedback in Chinese. Return ONLY valid JSON.`;
}

export async function POST(request: NextRequest) {
  try {
    const parsedRequest = await readApiBody(request, "grade-translation");
    if (parsedRequest.error) return parsedRequest.error;
    const body = parsedRequest.body as unknown as GradeRequest;
    const { sentence, reference, input } = body;

    if (!sentence?.trim() || !input?.trim()) {
      return NextResponse.json(
        { error: "Missing sentence or translation" },
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

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.3, // 评分要稳定，同一份译文不该忽高忽低
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an experienced 考研英语 teacher. You MUST respond with valid JSON only, no markdown formatting.",
        },
        { role: "user", content: buildPrompt({ sentence, reference, input }) },
      ],
    }, { signal: request.signal, timeout: 60000, maxRetries: 0 });

    const raw = completion.choices[0]?.message?.content || "";
    if (!raw) {
      return NextResponse.json(
        { error: "Empty response from DeepSeek" },
        { status: 500 }
      );
    }

    const parsed = parseLlmJson<{ score?: number }>(raw);
    if (!parsed.ok || !parsed.data) {
      console.error("Grade translation: JSON 解析失败", raw.slice(0, 200));
      return NextResponse.json({ error: "评分结果解析失败，请重试" }, { status: 500 });
    }

    const result = parsed.data;
    // 模型偶尔会给出超范围的分数，钳一下免得 UI 画出 12/10
    if (typeof result.score === "number") {
      result.score = Math.max(0, Math.min(10, Math.round(result.score)));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Grade translation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
