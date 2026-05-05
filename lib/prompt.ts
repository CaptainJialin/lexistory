import {
  WordItem,
  GrammarOption,
  GradeOption,
  ArticleTheme,
  ArticleStyle,
  THEME_LABELS,
  STYLE_LABELS,
} from "./types";

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

export function buildArticlePrompt(
  words: WordItem[],
  grammars: GrammarOption[],
  grade: GradeOption,
  theme: ArticleTheme = "none",
  style: ArticleStyle = "natural"
): string {
  const wordList = words
    .map((w) => {
      const phrases = w.phrases?.length
        ? ` (搭配: ${w.phrases.slice(0, 3).join(", ")})`
        : "";
      return `${w.word}${phrases}`;
    })
    .join(", ");
  const grammarList = grammars
    .map((g) => `${g.nameEn} (${g.name})`)
    .join("; ");
  const grammarNotes = grammars
    .map((g) => `- ${g.nameEn}: ${g.description}`)
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

${getStyleInstruction(style, grade)}

OUTPUT FORMAT (strict JSON):
{
  "title": "A catchy title for the article",
  "content": "The full article text. Use \\n\\n for paragraph breaks. IMPORTANT: Keep paragraphs SHORT. Each paragraph should contain at most 3-5 sentences. Do NOT write walls of text.",
  "translation": "A concise Chinese summary of the article's main idea (not word-for-word translation), appropriate for ${grade.name} students' understanding",
  "wordUsages": {
    "word1": "brief Chinese meaning",
    "word2": "brief Chinese meaning"
  },
  "sentences": [
    {
      "sentence": "exact sentence text from the article",
      "translation": "Chinese translation matching original structure",
      "constituents": [
        { "text": "exact text fragment", "label": "e.g. 主语, 谓语, 定语从句" }
      ],
      "difficultWords": [
        { "word": "as appears in sentence", "originalForm": "base form", "meaning": "Chinese meaning", "morphologicalNote": "brief note, under 10 chars", "partOfSpeech": "n.", "phonetic": "/phonetic/" }
      ],
      "grammars": [
        { "name": "语法名称，如 一般现在时", "explanation": "简要讲解该语法的原理和用法" }
      ],
      "phrases": [
        { "phrase": "短语，如 be able to", "meaning": "中文意思" }
      ]
    }
  ],
  "quiz": [
    {
      "id": "q1",
      "type": "word-meaning",
      "question": "English question asking about a vocabulary word from the article",
      "options": ["option A (English)", "option B (English)", "option C (English)", "option D (English)"],
      "correctIndex": 0,
      "explanation": "brief English explanation of why this answer is correct"
    },
    {
      "id": "q2",
      "type": "grammar-fill",
      "question": "English question about grammar used in the article, e.g. fill-in-the-blank or choose the correct form",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 1,
      "explanation": "brief English grammar explanation"
    },
    {
      "id": "q3",
      "type": "reading-comprehension",
      "question": "English question about the article's main idea, details, or inference",
      "options": ["option A (English)", "option B (English)", "option C (English)", "option D (English)"],
      "correctIndex": 2,
      "explanation": "brief English explanation based on the article"
    }
  ]
}

IMPORTANT for sentences analysis:
- Include EVERY sentence from the article in order. Each sentence MUST have a "translation".
- translation (CRITICAL): Provide a Chinese translation for EACH sentence. Match English structure closely.
- constituents: ONLY for sentences with complex grammar. List key constituents (主语, 谓语, 宾语, 定语从句, 状语, 表语, etc.). Each with exact "text" and "label". Non-overlapping, left-to-right. For simple sentences, you may omit this field.
- difficultWords: Only for genuinely challenging words at ${grade.cefr} level. For each:
  - "word": exact form used in sentence
  - "originalForm": dictionary form
  - "meaning": Chinese meaning
  - "morphologicalNote": brief note (under 10 Chinese chars)
  - "partOfSpeech": part of speech abbreviation, e.g. "n.", "v.", "adj.", "adv.", "prep.", "conj."
  - "phonetic": phonetic transcription in IPA, e.g. "/ˈkɑːnɪvl/"
  Omit this field if no difficult words in the sentence.
- grammars: ONLY for sentences that demonstrate a specific grammar point. List the grammar point(s) used in this sentence.
  - "name": the Chinese name of the grammar, e.g. "一般现在时", "被动语态", "定语从句"
  - "explanation": a brief Chinese explanation of how this grammar works (1-2 sentences). Keep it simple and clear.
  - Omit this field if the sentence uses only very basic grammar with nothing worth highlighting.
- phrases: ONLY for sentences containing useful collocations or phrases. List the phrase(s) with their Chinese meanings.
  - "phrase": the exact phrase as it appears in the sentence, e.g. "be able to", "take advantage of", "in terms of"
  - "meaning": concise Chinese meaning, e.g. "能够做某事", "利用", "就...而言"
  - Omit this field if no notable phrases in the sentence.

IMPORTANT for quiz generation:
- Include EXACTLY 3 questions. ALL text must be in ENGLISH.
- q1 (word-meaning): One target vocabulary word from the article. Question and all 4 options must be in English. Options are English words/phrases representing possible meanings.
- q2 (grammar-fill): One required grammar point used in the article. Question and all 4 options must be in English.
- q3 (reading-comprehension): Question about the article's main idea, details, or inference. Question and all 4 options must be in English.
- correctIndex: 0, 1, 2, or 3. Explanations brief, in English.

Ensure the JSON is valid and contains no markdown formatting.`;
}
