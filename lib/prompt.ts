import {
  WordItem,
  GrammarOption,
  GradeOption,
  ArticleTheme,
  ArticleStyle,
  LessonRole,
  THEME_LABELS,
  STYLE_LABELS,
} from "./types";

/** 生成一篇文章所需的全部输入。roles 缺省时全部按 new 处理。 */
export interface ArticlePromptInput {
  words: WordItem[];
  grammars: GrammarOption[];
  grade: GradeOption;
  theme?: ArticleTheme;
  style?: ArticleStyle;
  wordRoles?: Record<string, LessonRole>;
  grammarRoles?: Record<string, LessonRole>;
}

function roleOfWord(
  word: string,
  roles?: Record<string, LessonRole>
): LessonRole {
  return roles?.[word.toLowerCase()] ?? "new";
}

function roleOfGrammar(
  id: string,
  roles?: Record<string, LessonRole>
): LessonRole {
  return roles?.[id] ?? "new";
}

function getStyleInstruction(style: ArticleStyle, grade: GradeOption): string {
  const instructions: Record<string, string> = {
    natural:
      "WRITING STYLE - Natural/Original: Write in a natural, creative, and engaging style. The article should feel like a real piece of writing (story, article, or essay) rather than an exam passage. Encourage imaginative and vivid expression. Do not restrict yourself to exam formats.",
    none: "WRITING STYLE - Natural/Original: Write in a natural, creative, and engaging style. No exam-format restrictions.",
    "exam-entrance": `WRITING STYLE - 中考 (High School Entrance Exam) Style:
- Vocabulary: Stick strictly to textbook vocabulary. Avoid words beyond the ${grade.cefr} level. If a necessary word is slightly advanced, it should be inferable from context.
- Sentence patterns: Primarily simple and compound sentences. Use complex sentences sparingly and only when the grammar point requires it.
- Topics: Everyday student life (school, family, friendship, hobbies, environmental protection, traditional culture).
- Structure: Clear three-part structure (introduction → body → conclusion).
- Tone: Positive, uplifting, and aligned with mainstream values suitable for teenagers.
- Difficulty: Strictly match ${grade.cefr} / ${grade.name} level.`,
    "exam-college": `WRITING STYLE - 高考 (College Entrance Exam / Gaokao) Style:
- Vocabulary: Core exam syllabus vocabulary with appropriate use of academic words. Sentences more complex than junior high.
- Sentence patterns: Complex sentences, subordinate clauses, and participle structures used flexibly. Include some longer sentences but not excessively.
- Topics: Topics with social relevance and intellectual depth (technology and humanity, environmental issues, education, cultural heritage, personal growth).
- Structure: Introduction-thesis-body-conclusion with clear logical progression.
- Tone: Primarily objective and rational, occasionally with humanistic care.
- Difficulty: Strictly match ${grade.cefr} / ${grade.name} level.`,
    "exam-cet4": `WRITING STYLE - CET-4 (College English Test Band 4) Style:
- Vocabulary: General academic + everyday vocabulary. Avoid overly obscure technical terms.
- Sentence patterns: Expository and argumentative writing. Medium complexity sentences.
- Topics: Common topics such as technology, education, social trends, health, and environment.
- Structure: Typical expository/argumentative structure with clear paragraph transitions and logical connectors.
- Difficulty: Strictly match ${grade.cefr} / ${grade.name} level.`,
    "exam-cet6": `WRITING STYLE - CET-6 (College English Test Band 6) Style:
- Vocabulary: Higher density of academic vocabulary. Some specialized terms allowed if inferable from context.
- Sentence patterns: More long and complex sentences. Natural use of nested clauses, participles, inversion, and other advanced structures.
- Topics: Abstract topics (philosophical reflection, social criticism, technology ethics, globalization, etc.).
- Structure: Rigorous argumentation with clear thesis, supporting evidence, and conclusion.
- Difficulty: Strictly match ${grade.cefr} / ${grade.name} level.`,
    "exam-graduate": `WRITING STYLE - 考研英语 (Graduate Entrance Exam) Style:
- Vocabulary: Core考研大纲词汇 (5500词范围) with academic word focus. Use formal, precise academic register.
- Sentence patterns: Long, complex sentences with nested clauses, participles, appositives, and inversion. Heavy use of passive voice and nominalization.
- Topics: Social issues, economic policy, scientific research, cultural phenomena, educational reform, technological impact, environmental challenges.
- Structure: Thesis-driven expository/argumentative essay. Introduction with central claim → body paragraphs with topic sentences and supporting evidence → conclusion with implications.
- Tone: Objective, analytical, and scholarly. Avoid colloquial expressions.
- Difficulty: Strictly match ${grade.cefr} / ${grade.name} level.`,
  };

  const text = instructions[style] || instructions.natural;
  return text ? `STYLE REQUIREMENTS:\n${text}\n` : "";
}

function describeWord(w: WordItem): string {
  const phrases = w.phrases?.length
    ? ` (搭配: ${w.phrases.slice(0, 3).join(", ")})`
    : "";
  const targetMeaning = w.targetMeaning || w.meaning;
  const meaning = targetMeaning ? ` <target meaning: ${targetMeaning}>` : "";
  const meanings = w.meanings?.length
    ? ` <common meanings: ${w.meanings.slice(0, 4).join(" / ")}>`
    : "";
  const usagePatterns = w.usagePatterns?.length
    ? ` <usage patterns: ${w.usagePatterns.slice(0, 3).join("; ")}>`
    : "";
  const partOfSpeech = w.partOfSpeech ? ` [${w.partOfSpeech}]` : "";
  return `${w.word}${partOfSpeech}${meaning}${meanings}${phrases}${usagePatterns}`;
}

export function buildArticlePrompt(input: ArticlePromptInput): string {
  const {
    words,
    grammars,
    grade,
    theme = "none",
    style = "natural",
    wordRoles,
    grammarRoles,
  } = input;

  const newWords = words.filter((w) => roleOfWord(w.word, wordRoles) === "new");
  const reviewWords = words.filter(
    (w) => roleOfWord(w.word, wordRoles) === "review"
  );
  const newGrammars = grammars.filter(
    (g) => roleOfGrammar(g.id, grammarRoles) === "new"
  );
  const reviewGrammars = grammars.filter(
    (g) => roleOfGrammar(g.id, grammarRoles) === "review"
  );

  const wordList = words.map(describeWord).join(", ");

  const roleSection = `
VOCABULARY ROLES — this is the most important instruction in this prompt.

NEW words (${newWords.length}) — first encounter, the reader has never seen them:
${newWords.length ? newWords.map(describeWord).map((s) => `  * ${s}`).join("\n") : "  (none)"}
  → Embed each in a sentence with STRONG CONTEXT CLUES so an attentive reader can
    infer the meaning without a dictionary (apposition, contrast, example, or restatement).
  → Each must appear AT LEAST ONCE.

REVIEW words (${reviewWords.length}) — already studied, this article is their spaced repetition:
${reviewWords.length ? reviewWords.map(describeWord).map((s) => `  * ${s}`).join("\n") : "  (none)"}
  → Weave them in NATURALLY with NO explanatory scaffolding. Do not define them.
  → Prefer a DIFFERENT collocation or sentence pattern than the obvious dictionary example,
    so the reader meets the word in a fresh context.
  → Each must appear AT LEAST ONCE.

GRAMMAR ROLES

NEW grammar (${newGrammars.length}):
${newGrammars.length ? newGrammars.map((g) => `  * ${g.nameEn} — ${g.description}`).join("\n") : "  (none)"}
  → Demonstrate EACH at least 3 times, in clear and unambiguous sentences.

REVIEW grammar (${reviewGrammars.length}):
${reviewGrammars.length ? reviewGrammars.map((g) => `  * ${g.nameEn} — ${g.description}`).join("\n") : "  (none)"}
  → Demonstrate EACH at least 2 times, embedded in longer, more natural sentences.
`;

  const grammarNotes = grammars
    .map(
      (g) =>
        `- [id: ${g.id}] ${g.nameEn} (${g.name}) — ${roleOfGrammar(
          g.id,
          grammarRoles
        ).toUpperCase()}: ${g.description}`
    )
    .join("\n");

  const lengthGuidelines: Record<string, string> = {
    p1: "30-50 words, 1-2 very short paragraphs",
    p2: "40-60 words, 2 short paragraphs",
    p3: "50-80 words, 2-3 short paragraphs",
    p4: "80-120 words, 3 short paragraphs",
    p5: "100-150 words, 3 paragraphs",
    p6: "120-180 words, 3-4 paragraphs",
    j1: "150-200 words, 3-4 paragraphs",
    j2: "180-250 words, 4 paragraphs",
    j3: "200-280 words, 4 paragraphs",
    s1: "220-300 words, 4-5 paragraphs",
    s2: "250-350 words, 4-5 paragraphs",
    s3: "280-400 words, 4-5 paragraphs",
    c1: "300-450 words, 4-5 paragraphs",
    c2: "350-500 words, 5 paragraphs",
    c3: "400-600 words, 5 paragraphs",
    c4: "500-800 words, 5+ paragraphs",
    g1: "400-500 words, 4-5 paragraphs",
    g2: "450-600 words, 4-5 paragraphs",
    g3: "500-700 words, 5 paragraphs",
  };

  return `You are an English teacher creating reading material for Chinese students learning English.

TASK: Write a short English article that naturally incorporates the following vocabulary words and demonstrates the specified grammar points. The article MUST match the exact difficulty level described below.

REQUIREMENTS:
1. Vocabulary words to include naturally: ${wordList}
2. Grammar focus points (${grammars.length} total):
${grammarNotes}
3. The article should naturally demonstrate ALL of these grammar points throughout. Each grammar point should appear at least once in a correct and natural context.
4. Target education level: ${grade.name} (${grade.level})
5. CEFR equivalent: ${grade.cefr}
6. Length guideline: ${lengthGuidelines[grade.id] || "150-300 words"}
7. Difficulty requirements: ${grade.description}
8. Adjust sentence complexity, vocabulary sophistication, and conceptual depth STRICTLY to this grade level.
9. The story should be coherent, interesting, and have a clear theme appropriate for ${grade.name} students.
${theme !== "none" ? `9b. Theme/genre requirement: The article MUST be written with a "${theme}" theme. (${THEME_LABELS[theme]})` : ""}
${style !== "none" && style !== "natural" ? `9c. Writing style requirement: The article MUST follow the "${STYLE_LABELS[style]}" writing conventions described below.` : ""}
10. Each target vocabulary word should appear at least once in a natural context.
11. IMPORTANT: For each vocabulary word, try to use it in a natural collocation or phrase (as shown in parentheses). Do not just insert isolated words - embed them in common collocations, idioms, or natural phrases that ${grade.name} students would encounter in real English usage.
12. Sense control: if a word has a <target meaning>, use the word ONLY in that intended sense. Do not accidentally use another common meaning of the same spelling.
13. Usage control: if a word has <usage patterns>, use at least one listed pattern or a very close natural variant in the article. For example, if the pattern is "want to do sth", the article should contain a natural instance like "wanted to explore".
14. If a word does not provide targetMeaning or usagePatterns, choose one common grade-appropriate sense and one natural usage pattern yourself, then reflect that choice in wordUsages.
${roleSection}
${getStyleInstruction(style, grade)}

OUTPUT FORMAT (strict JSON):
{
  "title": "A catchy title for the article",
  "content": "The full article text. Use \\n\\n for paragraph breaks. IMPORTANT: Keep paragraphs SHORT. Each paragraph should contain at most 3-5 sentences. Do NOT write walls of text.",
  "translation": "A concise Chinese summary of the article's main idea (not word-for-word translation), appropriate for ${grade.name} students' understanding",
  "wordUsages": {
    "word1": "Chinese target meaning + the exact phrase/pattern used in the article",
    "word2": "Chinese target meaning + the exact phrase/pattern used in the article"
  },
  "quiz": [
    {
      "id": "q1",
      "type": "vocabulary-in-context",
      "question": "The word \\"X\\" (Para. 2) most probably means ___",
      "options": ["first choice in English", "second choice", "third choice", "fourth choice"],
      "correctIndex": 0,
      "explanation": "brief English explanation, including why the other options fail"
    },
    {
      "id": "q2",
      "type": "inference",
      "question": "It can be inferred from Paragraph 3 that ___",
      "options": ["first choice in English", "second choice", "third choice", "fourth choice"],
      "correctIndex": 1,
      "explanation": "brief English explanation, including why the other options fail"
    },
    {
      "id": "q3",
      "type": "main-idea",
      "question": "The best title for this text would be ___",
      "options": ["first choice in English", "second choice", "third choice", "fourth choice"],
      "correctIndex": 2,
      "explanation": "brief English explanation, including why the other options fail"
    }
  ]
}

IMPORTANT for wordUsages:
- Include EVERY target vocabulary word. For each entry, explain in Chinese the target sense practiced
  and name the actual collocation, fixed expression, or usage pattern used in the article.
  If the word has multiple common meanings, make clear which one this article uses.

IMPORTANT for quiz generation:
- Include EXACTLY 3 questions. ALL question text and options must be in ENGLISH.
- Model the questions on real 考研英语 reading comprehension items. Use these types and
  phrase the stems the way the actual exam does:

  * "vocabulary-in-context" 词义猜测题
      "The word \\"X\\" (Line N, Para. N) most probably means ___"
      "The phrase \\"X\\" is closest in meaning to ___"
      → MUST target one of the article's vocabulary words. Options are English paraphrases.
        The answer must be inferable from context, not just dictionary knowledge.

  * "detail" 细节理解题
      "According to Paragraph N, ___"
      "Which of the following is true about X?"

  * "inference" 推理判断题
      "It can be inferred from Paragraph N that ___"
      "The author implies that ___"
      → The answer must NOT be stated verbatim in the text; it must require a real inference.

  * "main-idea" 主旨大意题
      "The best title for this text would be ___"
      "The text is mainly about ___"

  * "attitude" 态度观点题
      "The author's attitude toward X can best be described as ___"
      → Options should be attitude words (e.g. skeptical / supportive / neutral / critical).

- Pick 3 DIFFERENT types. Always include one "vocabulary-in-context" (it checks the target
  words); choose the other two from detail / inference / main-idea / attitude, matching
  whatever the article can actually support.
- Distractors must be plausible — wrong options should be tempting to someone who skimmed,
  not obviously absurd. That is what makes the practice worth anything.
- correctIndex: 0, 1, 2, or 3. Explanations brief, in English, and must say WHY the other
  options fail, not just restate the answer.
- Each option must be BARE TEXT ONLY. Do NOT prefix options with "A." / "B." / "(A)" / "1." —
  the app renders the letter labels itself, so a prefix shows up doubled as "A  A. unchangeable".

Ensure the JSON is valid and contains no markdown formatting.`;
}

// ====== 逐句解析 ======

/**
 * 句子解析单独成一次调用。
 *
 * 之前是和文章一起生成的，但两者加起来经常超出 deepseek-chat 的 8192 输出上限，
 * 响应被截断后整个 JSON 都解析不了——用户等一分钟只拿到一句报错，正文也一起丢了。
 * 拆开后两次调用各自都远低于上限，而且模型面对已经写好的文本做分析，标注也更准。
 */
export interface AnalysisPromptInput {
  content: string;
  grammars: GrammarOption[];
  grade: GradeOption;
}

export function buildAnalysisPrompt(input: AnalysisPromptInput): string {
  const { content, grammars, grade } = input;

  const grammarList = grammars
    .map((g) => `- [id: ${g.id}] ${g.nameEn} (${g.name}) — ${g.description}`)
    .join("\n");

  return `You are an English teacher annotating a reading passage for Chinese students at ${grade.name} (${grade.cefr}) level.

ARTICLE:
"""
${content}
"""

REQUIRED GRAMMAR POINTS (use these exact ids when tagging):
${grammarList || "(none)"}

TASK: Break the article into sentences IN ORDER and annotate each one.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "sentences": [
    {
      "sentence": "exact sentence text, copied verbatim from the article",
      "translation": "中文翻译，尽量贴合原句结构",
      "constituents": [
        { "text": "exact text fragment", "label": "如 主语 / 谓语 / 宾语 / 定语从句 / 状语" }
      ],
      "difficultWords": [
        { "word": "句中实际形式", "originalForm": "原形", "meaning": "中文释义", "morphologicalNote": "10字以内说明", "partOfSpeech": "n.", "phonetic": "/ˈkɑːnɪvl/" }
      ],
      "grammars": [
        { "grammarId": "上面列出的 id 之一，对不上就省略此字段", "name": "语法名称", "explanation": "1-2 句中文讲解" }
      ],
      "phrases": [
        { "phrase": "如 be able to", "meaning": "中文意思" }
      ]
    }
  ]
}

RULES:
- "sentence" MUST be copied verbatim from the article, including punctuation. Do not rewrite, merge or split sentences differently from the original text. Cover EVERY sentence, in order.
- "translation" is REQUIRED for every sentence.
- "constituents": ONLY for sentences with complex structure. Fragments must be exact substrings, non-overlapping, left-to-right. Omit the field for simple sentences.
- "difficultWords": ONLY genuinely challenging words at ${grade.cefr} level. Omit the field if none.
- "grammars": ONLY when the sentence genuinely demonstrates a grammar point.
  - Set "grammarId" to the exact id from the list above when it matches; omit grammarId for other grammar.
  - DO NOT force a required grammar onto a sentence that does not contain it. These annotations are
    shown to the learner as worked examples, so a wrong tag teaches the wrong thing.
    WRONG: {"sentence": "Last summer, I went to Xi'an.",
            "grammars": [{"grammarId": "relative-clauses", "name": "定语从句",
                          "explanation": "本句没有定语从句，但时态为一般过去时。"}]}
    RIGHT: {"sentence": "Last summer, I went to Xi'an."}   // 整个 grammars 字段都不要
  - Omit the field entirely if the sentence has nothing worth highlighting.
- "phrases": ONLY for useful collocations. Omit the field if none.
- Keep explanations concise. Return ONLY valid JSON.`;
}
