// ====== 文章题材 ======
export type ArticleTheme =
  | "story"
  | "news"
  | "sci-fi"
  | "daily"
  | "adventure"
  | "social"
  | "frontier"
  | "economy"
  | "livelihood"
  | "biography"
  | "travel"
  | "history"
  | "nature"
  | "none";

export const THEME_LABELS: Record<ArticleTheme, string> = {
  story: "故事",
  news: "新闻",
  "sci-fi": "科幻",
  daily: "日常",
  adventure: "冒险",
  social: "社会",
  frontier: "前沿科技",
  economy: "经济",
  livelihood: "民生",
  biography: "人物传记",
  travel: "游记",
  history: "历史",
  nature: "自然",
  none: "随机",
};

// ====== 文章风格 / 考试模拟 ======
export type ArticleStyle =
  | "natural"
  | "exam-entrance"
  | "exam-college"
  | "exam-cet4"
  | "exam-cet6"
  | "exam-graduate"
  | "none";

export const STYLE_LABELS: Record<ArticleStyle, string> = {
  natural: "自然原创",
  "exam-entrance": "中考风格",
  "exam-college": "高考风格",
  "exam-cet4": "四级风格",
  "exam-cet6": "六级风格",
  "exam-graduate": "考研英语",
  none: "默认",
};

export interface WordItem {
  word: string;
  meaning?: string;
  phrases?: string[];
}

export interface GrammarOption {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  description: string;
}

export type EducationLevel = "primary" | "junior" | "senior" | "college" | "graduate";

export interface GradeOption {
  id: string;
  name: string;
  level: EducationLevel;
  cefr: string;
  description: string;
}

export interface DifficultyLevel {
  level: EducationLevel;
  gradeId: string;
}

export interface GrammarPattern {
  pattern: string; // 英文语法结构，如 "hear sb do sth"
  meaning: string; // 中文释义，如 "听见某人做某事（全过程）"
  confusions?: {
    // 常见易混淆形式
    pattern: string; // 如 "hear sb doing sth"
    note: string; // 如 "听见某人正在做某事（强调正在进行）"
  }[];
}

export interface SentenceConstituent {
  text: string;   // 原句中的精确文本片段
  label: string;  // 成分标签，如 "主语", "谓语", "定语从句", "宾语", "状语" 等
}

export interface SentenceGrammar {
  name: string;        // 语法名称，如 "一般现在时"
  explanation: string; // 简单讲解原理
}

export interface SentencePhrase {
  phrase: string;  // 短语，如 "be able to"
  meaning: string; // 中文意思
}

export interface SentenceAnalysis {
  sentence: string;
  translation?: string; // 该句子的中文逐句翻译
  structure?: string;   // 已弃用，保留兼容旧数据
  constituents?: SentenceConstituent[]; // 句子成分标注（在原句对应位置下显示标签）
  difficultWords?: {
    word: string;
    originalForm?: string;
    meaning: string;
    morphologicalNote?: string;
    partOfSpeech?: string; // 词性缩写，如 n. / v. / adj. / adv.
    phonetic?: string;     // 音标，如 /ˈkɑːnɪvl/
  }[];
  grammarNotes?: string; // 已弃用，保留兼容旧数据
  grammarPatterns?: (string | GrammarPattern)[]; // 已弃用，保留兼容旧数据
  grammars?: SentenceGrammar[]; // 句子中出现的语法点
  phrases?: SentencePhrase[];   // 句子中出现的短语
}

export interface Article {
  id: string;
  title: string;
  content: string;
  translation: string;
  words: WordItem[];
  grammar: GrammarOption[];
  difficulty: DifficultyLevel;
  sentences?: SentenceAnalysis[];
  quiz?: QuizQuestion[];
  wordUsages?: Record<string, string>;
  theme?: ArticleTheme;
  style?: ArticleStyle;
  createdAt: number;
}

export const LEVEL_LABELS: Record<EducationLevel, string> = {
  primary: "小学",
  junior: "初中",
  senior: "高中",
  college: "大学",
  graduate: "考研",
};

export const GRADE_OPTIONS: GradeOption[] = [
  // 小学 1-6 年级
  { id: "p1", name: "一年级", level: "primary", cefr: "Pre-A1", description: "极短句型，高频基础词汇，大量图片辅助理解" },
  { id: "p2", name: "二年级", level: "primary", cefr: "Pre-A1", description: "简单陈述句，日常词汇，句长 3-5 词" },
  { id: "p3", name: "三年级", level: "primary", cefr: "A1", description: "简单问答和描述，使用现在时，句长 5-8 词" },
  { id: "p4", name: "四年级", level: "primary", cefr: "A1", description: "能写简单段落，引入过去时，词汇量 500-800" },
  { id: "p5", name: "五年级", level: "primary", cefr: "A1+", description: "连词使用增加，能描述计划与喜好，句型稍复杂" },
  { id: "p6", name: "六年级", level: "primary", cefr: "A2", description: "简单复合句，时态混合，能写 80-100 词短文" },

  // 初中 3 年
  { id: "j1", name: "初一", level: "junior", cefr: "A2", description: "基础语法完整覆盖，能进行日常话题的连贯表达" },
  { id: "j2", name: "初二", level: "junior", cefr: "A2+", description: "多种时态混合，从句初现，文章长度 120-150 词" },
  { id: "j3", name: "初三", level: "junior", cefr: "B1", description: "中考难度，逻辑连接词丰富，能表达观点和原因" },

  // 高中 3 年
  { id: "s1", name: "高一", level: "senior", cefr: "B1", description: "篇章结构清晰，词汇量 2500+，能处理抽象话题" },
  { id: "s2", name: "高二", level: "senior", cefr: "B1+", description: "复杂句式增多，语态和从句灵活运用，接近高考难度" },
  { id: "s3", name: "高三", level: "senior", cefr: "B2", description: "高考及略高于高考，论证性表达，词汇精准" },

  // 大学 4 年
  { id: "c1", name: "大一", level: "college", cefr: "B2", description: "CET-4 水平，能阅读一般性学术材料，表达较为成熟" },
  { id: "c2", name: "大二", level: "college", cefr: "B2+", description: "CET-6 水平，长难句理解，具备一定批判性思维" },
  { id: "c3", name: "大三", level: "college", cefr: "C1", description: "考研/雅思 6.5-7 水平，学术词汇，复杂论证" },
  { id: "c4", name: "大四", level: "college", cefr: "C1+", description: "专八/雅思 7.5+ 水平，语言地道，思想深度高" },

  // 考研 3 个阶段
  { id: "g1", name: "考研基础", level: "graduate", cefr: "C1", description: "考研高频核心词 + 基础语法，文章长度 400-500 词，议论为主" },
  { id: "g2", name: "考研强化", level: "graduate", cefr: "C1+", description: "考研大纲全词 + 长难句分析，文章长度 450-600 词，论证复杂" },
  { id: "g3", name: "考研冲刺", level: "graduate", cefr: "C2", description: "真题难度，长难句密集，抽象话题，文章长度 500-700 词" },
];

// 语法分类标签
export const PROFICIENCY_LABELS = ["陌生", "认识", "熟悉", "掌握"] as const;

export const GRAMMAR_CATEGORIES = [
  "时态",
  "词法",
  "非谓语动词",
  "从句",
  "特殊句式",
] as const;

export const GRAMMAR_OPTIONS: GrammarOption[] = [
  // ========== 时态 (8个核心时态) ==========
  {
    id: "simple-present",
    name: "一般现在时",
    nameEn: "Simple Present Tense",
    category: "时态",
    description: "表示经常性、习惯性的动作或状态，如：I go to school every day.（我每天上学。）",
  },
  {
    id: "present-continuous",
    name: "现在进行时",
    nameEn: "Present Continuous Tense",
    category: "时态",
    description: "表示正在进行的动作，如：She is reading a book.（她正在读书。）",
  },
  {
    id: "simple-past",
    name: "一般过去时",
    nameEn: "Simple Past Tense",
    category: "时态",
    description: "表示过去发生的动作或状态，如：He visited Beijing last year.（他去年去了北京。）",
  },
  {
    id: "past-continuous",
    name: "过去进行时",
    nameEn: "Past Continuous Tense",
    category: "时态",
    description: "表示过去某一时刻正在进行的动作，如：They were playing when I arrived.（我到时他们正在玩。）",
  },
  {
    id: "present-perfect",
    name: "现在完成时",
    nameEn: "Present Perfect Tense",
    category: "时态",
    description: "表示过去发生但对现在有影响的动作，如：I have lost my key.（我把钥匙弄丢了。）",
  },
  {
    id: "past-perfect",
    name: "过去完成时",
    nameEn: "Past Perfect Tense",
    category: "时态",
    description: "表示「过去的过去」发生的动作，如：She had left before I came.（我来之前她就已经走了。）",
  },
  {
    id: "simple-future",
    name: "一般将来时",
    nameEn: "Simple Future Tense",
    category: "时态",
    description: "表示将要发生的动作或状态，如：I will call you tomorrow.（我明天给你打电话。）",
  },
  {
    id: "future-in-the-past",
    name: "过去将来时",
    nameEn: "Future in the Past",
    category: "时态",
    description: "表示从过去看将要发生的事，如：He said he would come.（他说他会来的。）",
  },

  // ========== 词法 ==========
  {
    id: "noun-plural",
    name: "名词单复数",
    nameEn: "Noun Plurals",
    category: "词法",
    description: "规则与不规则复数变化，如：cat→cats, child→children, tooth→teeth",
  },
  {
    id: "articles",
    name: "冠词",
    nameEn: "Articles",
    category: "词法",
    description: "不定冠词 a/an、定冠词 the 和零冠词的用法，如：an apple / the sun",
  },
  {
    id: "pronouns",
    name: "代词",
    nameEn: "Pronouns",
    category: "词法",
    description: "人称代词、物主代词、反身代词、不定代词，如：myself, someone, each other",
  },
  {
    id: "comparative-superlative",
    name: "比较级与最高级",
    nameEn: "Comparative & Superlative",
    category: "词法",
    description: "形容词和副词的比较级、最高级变化，如：taller / tallest / more beautiful",
  },
  {
    id: "prepositions",
    name: "介词",
    nameEn: "Prepositions",
    category: "词法",
    description: "时间、地点、方式介词的用法，如：in the morning, at school, by bus",
  },
  {
    id: "numerals",
    name: "数词",
    nameEn: "Numerals",
    category: "词法",
    description: "基数词、序数词、分数、百分数的表达，如：twenty-first, three quarters",
  },

  // ========== 非谓语动词 ==========
  {
    id: "infinitive",
    name: "不定式",
    nameEn: "Infinitive",
    category: "非谓语动词",
    description: "to do 的各种用法，如：I want to learn. / To see is to believe.（眼见为实。）",
  },
  {
    id: "gerund",
    name: "动名词",
    nameEn: "Gerund",
    category: "非谓语动词",
    description: "动词-ing 作名词使用，如：Swimming is good for health.（游泳有益健康。）",
  },
  {
    id: "participles",
    name: "分词",
    nameEn: "Participles",
    category: "非谓语动词",
    description: "现在分词和过去分词作定语、状语、补足语，如：a sleeping baby / broken glass",
  },

  // ========== 从句 ==========
  {
    id: "relative-clauses",
    name: "定语从句",
    nameEn: "Relative Clauses",
    category: "从句",
    description: "用关系代词/副词修饰名词，如：The book that I bought is interesting.（我买的那本书很有趣。）",
  },
  {
    id: "noun-clauses",
    name: "名词性从句",
    nameEn: "Noun Clauses",
    category: "从句",
    description: "主语/宾语/表语/同位语从句，如：I believe that he will win.（我相信他会赢。）",
  },
  {
    id: "adverbial-clauses-time",
    name: "时间状语从句",
    nameEn: "Adverbial Clauses of Time",
    category: "从句",
    description: "when, while, before, after, until, as soon as 等引导，如：Call me when you arrive.（到了给我电话。）",
  },
  {
    id: "adverbial-clauses-condition",
    name: "条件状语从句",
    nameEn: "Adverbial Clauses of Condition",
    category: "从句",
    description: "if, unless, as long as 引导，如：You will succeed if you work hard.（努力就会成功。）",
  },
  {
    id: "adverbial-clauses-reason",
    name: "原因状语从句",
    nameEn: "Adverbial Clauses of Reason",
    category: "从句",
    description: "because, since, as 引导，如：I stayed home because it rained.（因为下雨我待在家。）",
  },
  {
    id: "adverbial-clauses-concession",
    name: "让步状语从句",
    nameEn: "Adverbial Clauses of Concession",
    category: "从句",
    description: "although, though, even though 引导，如：Although tired, he kept working.（尽管累，他仍继续工作。）",
  },
  {
    id: "adverbial-clauses-result",
    name: "结果状语从句",
    nameEn: "Adverbial Clauses of Result",
    category: "从句",
    description: "so...that, such...that 引导，如：It was so cold that we stayed inside.（太冷了，我们只能待在屋里。）",
  },
  {
    id: "adverbial-clauses-purpose",
    name: "目的状语从句",
    nameEn: "Adverbial Clauses of Purpose",
    category: "从句",
    description: "so that, in order that 引导，如：I study hard so that I can pass.（我努力学习以便能通过。）",
  },

  // ========== 特殊句式 ==========
  {
    id: "passive-voice",
    name: "被动语态",
    nameEn: "Passive Voice",
    category: "特殊句式",
    description: "强调动作的承受者，如：The cake was eaten by him.（蛋糕被他吃了。）",
  },
  {
    id: "conditional-1",
    name: "第一条件句（真实条件）",
    nameEn: "First Conditional",
    category: "特殊句式",
    description: "表示未来可能发生的真实条件，如：If it rains, I will stay home.（如果下雨，我就待在家。）",
  },
  {
    id: "conditional-2",
    name: "第二条件句（虚拟现在）",
    nameEn: "Second Conditional",
    category: "特殊句式",
    description: "表示现在/未来的虚拟条件，如：If I were rich, I would travel.（如果我有钱，我就去旅行。）",
  },
  {
    id: "conditional-3",
    name: "第三条件句（虚拟过去）",
    nameEn: "Third Conditional",
    category: "特殊句式",
    description: "表示与过去事实相反的虚拟，如：If I had known, I would have helped.（如果我知道，我就帮忙了。）",
  },
  {
    id: "subjunctive-mood",
    name: "虚拟语气",
    nameEn: "Subjunctive Mood",
    category: "特殊句式",
    description: "表示愿望、建议、假设等非真实情况，如：I wish I were taller.（我希望我更高。）",
  },
  {
    id: "direct-indirect-speech",
    name: "直接引语与间接引语",
    nameEn: "Direct & Indirect Speech",
    category: "特殊句式",
    description: "转述他人话语，如：He said, 'I am tired.' → He said (that) he was tired.",
  },
  {
    id: "cleft-sentences",
    name: "强调句",
    nameEn: "Cleft Sentences",
    category: "特殊句式",
    description: "用 It is...that/who... 强调句子某部分，如：It was Tom who broke the window.（是汤姆打破了窗户。）",
  },
  {
    id: "inversion",
    name: "倒装句",
    nameEn: "Inversion",
    category: "特殊句式",
    description: "将谓语或助动词提前，如：Never have I seen such beauty.（我从未见过如此美景。）",
  },
  {
    id: "there-be",
    name: "There be 句型",
    nameEn: "There be Structure",
    category: "特殊句式",
    description: "表示「某地有某物」，如：There are many books on the shelf.（书架上有很多书。）",
  },
  {
    id: "imperative",
    name: "祈使句",
    nameEn: "Imperative Sentences",
    category: "特殊句式",
    description: "表示命令、请求、建议，如：Please close the door. / Don't be late.（请关门。/ 别迟到。）",
  },
  {
    id: "exclamatory",
    name: "感叹句",
    nameEn: "Exclamatory Sentences",
    category: "特殊句式",
    description: "表达强烈情感，如：What a beautiful day! / How interesting it is!（多美的一天啊！）",
  },
];

// 按 category 分组，用于 UI 展示
export function groupGrammarsByCategory(): Record<string, GrammarOption[]> {
  return GRAMMAR_OPTIONS.reduce((acc, g) => {
    if (!acc[g.category]) acc[g.category] = [];
    acc[g.category].push(g);
    return acc;
  }, {} as Record<string, GrammarOption[]>);
}

export function getGrammarsByIds(ids: string[]): GrammarOption[] {
  return ids
    .map((id) => GRAMMAR_OPTIONS.find((g) => g.id === id))
    .filter((g): g is GrammarOption => g !== undefined);
}

export function getGradeById(id: string): GradeOption | undefined {
  return GRADE_OPTIONS.find((g) => g.id === id);
}

export function getGradesByLevel(level: EducationLevel): GradeOption[] {
  return GRADE_OPTIONS.filter((g) => g.level === level);
}

// ====== 单词常见搭配 ======
export const WORD_PHRASES: Record<string, string[]> = {
  // primary
  friend: ["make friends", "best friend", "a good friend"],
  happy: ["feel happy", "happy birthday"],
  school: ["at school", "go to school", "after school"],
  family: ["my family", "family member"],
  color: ["what color", "favorite color"],
  animal: ["wild animal", "favorite animal"],
  water: ["drink water", "a glass of water"],
  music: ["listen to music", "like music"],
  dance: ["dance to", "love to dance"],
  paint: ["paint a picture", "love to paint"],
  smile: ["smile at", "big smile"],
  laugh: ["laugh at", "make me laugh"],
  summer: ["in summer", "summer vacation"],
  winter: ["in winter", "winter holiday"],
  morning: ["in the morning", "every morning"],
  evening: ["in the evening"],
  story: ["tell a story", "love stories"],
  dream: ["have a dream", "dream about"],
  game: ["play a game", "video game"],
  toy: ["play with toys", "favorite toy"],
  bird: ["a little bird", "bird song"],
  fish: ["catch fish"],
  tree: ["climb a tree", "under the tree"],
  river: ["by the river", "swim in the river"],
  mountain: ["climb mountains", "high mountain"],
  cloud: ["white cloud", "in the clouds"],
  rainbow: ["see a rainbow"],
  star: ["bright star"],
  moon: ["full moon", "moon light"],
  sun: ["in the sun", "sun shine"],
  book: ["read a book", "story book"],
  pencil: ["a red pencil", "pencil case"],
  table: ["on the table", "dinner table"],
  chair: ["sit on a chair"],
  door: ["open the door", "close the door"],
  window: ["open the window", "look out the window"],
  garden: ["in the garden", "beautiful garden"],
  park: ["in the park", "go to the park"],
  run: ["run fast", "run away"],
  jump: ["jump high", "jump over"],
  walk: ["walk to school", "go for a walk"],
  swim: ["swim in the pool", "love to swim"],
  eat: ["eat breakfast", "eat up"],
  drink: ["drink water", "drink milk"],
  sleep: ["go to sleep", "sleep well"],
  wake: ["wake up", "early wake"],
  play: ["play games", "play with"],
  sing: ["sing a song", "love to sing"],

  // junior
  journey: ["go on a journey", "long journey"],
  adventure: ["go on an adventure", "exciting adventure"],
  challenge: ["face a challenge", "accept the challenge"],
  curious: ["curious about", "feel curious"],
  confidence: ["have confidence", "build confidence"],
  knowledge: ["gain knowledge", "knowledge is power"],
  culture: ["local culture", "different cultures"],
  tradition: ["family tradition", "old tradition"],
  community: ["local community", "community service"],
  environment: ["protect the environment", "natural environment"],
  resource: ["natural resource", "human resource"],
  technology: ["new technology", "modern technology"],
  influence: ["have influence on", "under the influence"],
  achievement: ["great achievement", "sense of achievement"],
  opportunity: ["good opportunity", "take the opportunity"],
  responsibility: ["take responsibility", "social responsibility"],
  communication: ["good communication", "communication skills"],
  relationship: ["good relationship", "build a relationship"],
  development: ["economic development", "personal development"],
  improvement: ["great improvement", "room for improvement"],
  difference: ["make a difference", "tell the difference"],
  importance: ["the importance of", "of great importance"],
  beautiful: ["beautiful scenery", "beautiful day"],
  wonderful: ["wonderful time", "wonderful idea"],
  excellent: ["excellent grade", "excellent work"],
  terrible: ["terrible weather", "feel terrible"],
  necessary: ["necessary for", "if necessary"],
  possible: ["as possible", "make it possible"],
  impossible: ["impossible to", "nothing is impossible"],
  comfortable: ["feel comfortable", "comfortable life"],
  familiar: ["familiar with", "familiar face"],
  popular: ["popular with", "become popular"],
  encourage: ["encourage sb to do", "feel encouraged"],
  support: ["support sb", "give support to"],
  appreciate: ["appreciate your help", "I appreciate it"],
  apologize: ["apologize for", "say sorry"],
  explain: ["explain to sb", "explain why"],
  describe: ["describe sth", "hard to describe"],
  compare: ["compare with", "compare to"],
  prepare: ["prepare for", "get prepared"],
  protect: ["protect from", "protect the environment"],

  // senior
  phenomenon: ["natural phenomenon", "social phenomenon"],
  significant: ["significant change", "play a significant role"],
  perspective: ["from my perspective", "new perspective"],
  consequence: ["as a consequence", "face the consequence"],
  circumstance: ["under the circumstance", "in any circumstance"],
  controversial: ["controversial issue", "highly controversial"],
  sophisticated: ["sophisticated technology", "sophisticated person"],
  comprehensive: ["comprehensive plan", "comprehensive understanding"],
  substantial: ["substantial change", "substantial amount"],
  remarkable: ["remarkable achievement", "remarkable progress"],
  contribution: ["make a contribution", "contribution to"],
  assumption: ["make an assumption", "based on the assumption"],
  implication: ["have implication for", "wide implication"],
  evaluation: ["critical evaluation", "self-evaluation"],
  entrepreneur: ["young entrepreneur", "successful entrepreneur"],
  innovation: ["technological innovation", "drive innovation"],
  sustainability: ["environmental sustainability", "sustainability goal"],
  globalization: ["economic globalization", "impact of globalization"],
  urbanization: ["rapid urbanization", "process of urbanization"],
  biodiversity: ["protect biodiversity", "loss of biodiversity"],
  ecosystem: ["marine ecosystem", "ecosystem balance"],
  atmosphere: ["friendly atmosphere", "in the atmosphere"],
  transformation: ["social transformation", "undergo transformation"],
  hypothesis: ["test a hypothesis", "working hypothesis"],
  experiment: ["conduct an experiment", "scientific experiment"],
  observation: ["careful observation", "based on observation"],
  conclusion: ["draw a conclusion", "in conclusion"],
  evidence: ["strong evidence", "evidence shows"],
  theory: ["scientific theory", "in theory"],
  persuade: ["persuade sb to do", "hard to persuade"],
  convince: ["convince sb of", "convince me"],
  analyze: ["analyze data", "carefully analyze"],
  advocate: ["advocate for", "strong advocate"],
  formulate: ["formulate a plan", "formulate policy"],
  articulate: ["articulate ideas", "clearly articulate"],
  elaborate: ["elaborate on", "in more elaborate detail"],
  philosophy: ["life philosophy", "eastern philosophy"],
  psychology: ["child psychology", "applied psychology"],
  literature: ["classic literature", "English literature"],
  civilization: ["ancient civilization", "human civilization"],
  democracy: ["democratic system", "defend democracy"],
  consciousness: ["social consciousness", "lose consciousness"],
  metaphor: ["use a metaphor", "extended metaphor"],
  paradox: ["apparent paradox", "resolve the paradox"],
  dilemma: ["face a dilemma", "moral dilemma"],

  // college
  paradigm: ["new paradigm", "paradigm shift"],
  pragmatic: ["pragmatic approach", "pragmatic solution"],
  empirical: ["empirical evidence", "empirical study"],
  deductive: ["deductive reasoning"],
  inductive: ["inductive reasoning"],
  abductive: ["abductive reasoning"],
  proposition: ["main proposition", "logical proposition"],
  inference: ["draw inference", "statistical inference"],
  syllogism: ["logical syllogism"],
  phenomenology: ["phenomenology of"],
  existentialism: ["theory of existentialism"],
  deconstruction: ["literary deconstruction"],
  postmodernism: ["postmodernism in"],
  neoliberalism: ["rise of neoliberalism"],
  intersectionality: ["theory of intersectionality"],
  hegemony: ["cultural hegemony"],
  diaspora: ["Jewish diaspora", "Chinese diaspora"],
  cosmopolitan: ["cosmopolitan city", "cosmopolitan attitude"],
  multiculturalism: ["policy of multiculturalism"],
  bureaucracy: ["government bureaucracy"],
  meritocracy: ["meritocracy system"],
  plutocracy: ["rule by plutocracy"],
  technocracy: ["technocracy governance"],
  gerrymandering: ["electoral gerrymandering"],
  precedent: ["legal precedent", "set a precedent"],
  jurisdiction: ["under the jurisdiction"],
  contingency: ["contingency plan"],
  vicarious: ["vicarious experience"],
  ephemeral: ["ephemeral nature"],
  pervasive: ["pervasive influence"],
  tenuous: ["tenuous connection"],
  inexorable: ["inexorable progress"],
  inscrutable: ["inscrutable smile"],
  quintessential: ["quintessential example"],
  ubiquitous: ["ubiquitous presence"],
  esoteric: ["esoteric knowledge"],
  idiosyncratic: ["idiosyncratic style"],
  perspicacious: ["perspicacious observation"],

  // graduate
  benefit: ["benefit from", "for the benefit of", "mutual benefit"],
  advantage: ["take advantage of", "have an advantage over", "to one's advantage"],
  demand: ["in demand", "meet the demand", "supply and demand"],
  economic: ["economic growth", "economic policy", "economic crisis"],
  financial: ["financial market", "financial crisis", "financial support"],
  market: ["stock market", "labor market", "market economy"],
  commercial: ["commercial value", "commercial use", "commercial activity"],
  trade: ["international trade", "trade war", "free trade"],
  industry: ["heavy industry", "service industry", "film industry"],
  investment: ["foreign investment", "investment in", "return on investment"],
  profit: ["make a profit", "net profit", "non-profit"],
  cost: ["at the cost of", "the cost of living", "reduce cost"],
  expense: ["at the expense of", "living expenses", "business expense"],
  employment: ["full employment", "employment rate", "seek employment"],
  policy: ["public policy", "economic policy", "policy maker"],
  reform: ["education reform", "social reform", "reform and opening"],
  device: ["electronic device", "mobile device", "medical device"],
  system: ["education system", "legal system", "operating system"],
  digital: ["digital age", "digital transformation", "digital economy"],
  data: ["big data", "data analysis", "personal data"],
  research: ["scientific research", "research into", "carry out research"],
  progress: ["make progress", "social progress", "in progress"],
  advance: ["in advance", "technological advance", "advance in"],
  pollution: ["air pollution", "environmental pollution", "reduce pollution"],
  protection: ["environmental protection", "consumer protection", "under the protection of"],
  climate: ["climate change", "climate crisis", "global climate"],
  global: ["global warming", "global economy", "global market"],
  energy: ["renewable energy", "solar energy", "energy crisis"],
  sustainable: ["sustainable development", "sustainable growth"],
  damage: ["cause damage", "environmental damage", "brain damage"],
  education: ["higher education", "online education", "education reform"],
  academic: ["academic research", "academic achievement", "academic year"],
  learning: ["lifelong learning", "distance learning", "machine learning"],
  skill: ["communication skills", "technical skills", "soft skills"],
  ability: ["the ability to", "mental ability", "natural ability"],
  talent: ["natural talent", "talent show", "attract talent"],
  language: ["native language", "body language", "official language"],
  behavior: ["human behavior", "social behavior", "bad behavior"],
  attitude: ["positive attitude", "attitude towards", "change one's attitude"],
  health: ["public health", "mental health", "healthcare system"],
  medicine: ["traditional medicine", "western medicine", "take medicine"],
  treatment: ["medical treatment", "receive treatment", "equal treatment"],
  disease: ["heart disease", "infectious disease", "prevent disease"],
  recovery: ["economic recovery", "recovery from", "in recovery"],
  fitness: ["physical fitness", "fitness center", "fitness goal"],
  nutrition: ["good nutrition", "nutrition and health", "proper nutrition"],
  mental: ["mental health", "mental state", "mental illness"],
  emotion: ["strong emotion", "express emotion", "mixed emotions"],
  stress: ["under stress", "stress management", "reduce stress"],
  anxiety: ["social anxiety", "reduce anxiety", "feel anxiety"],
  depression: ["economic depression", "suffer from depression", "clinical depression"],
  government: ["local government", "central government", "government policy"],
  political: ["political system", "political party", "political reform"],
  law: ["obey the law", "break the law", "international law"],
  legal: ["legal system", "legal advice", "legal rights"],
  justice: ["social justice", "criminal justice", "in justice"],
  freedom: ["personal freedom", "freedom of speech", "economic freedom"],
  power: ["political power", "solar power", "in power"],
  authority: ["local authority", "have authority over", "under the authority of"],
  control: ["under control", "take control of", "out of control"],
  regulation: ["government regulation", "strict regulation", "financial regulation"],
  demonstrate: ["demonstrate ability", "demonstrate skill", "demonstrate concern"],
  indicate: ["clearly indicate", "strongly indicate", "as indicated"],
  interpret: ["interpret data", "interpret meaning", "widely interpreted"],
  maintain: ["maintain balance", "maintain order", "maintain relationship"],
  preserve: ["preserve culture", "preserve environment", "well-preserved"],
  resolve: ["resolve conflict", "resolve issue", "resolve to do"],
  respond: ["respond to", "respond quickly", "failure to respond"],
  reveal: ["reveal truth", "reveal secret", "study reveals"],
  generate: ["generate income", "generate electricity", "generate interest"],
  identify: ["identify problem", "identify with", "identify as"],
  illustrate: ["illustrate point", "clearly illustrate", "as illustrated"],
  impose: ["impose on", "impose restriction", "impose tax"],
  emerge: ["emerge from", "newly emerge", "emerging market"],
  enhance: ["enhance ability", "enhance performance", "enhance understanding"],
  ensure: ["ensure safety", "ensure quality", "ensure success"],
  establish: ["establish relationship", "establish system", "well-established"],
  exceed: ["exceed expectation", "exceed limit", "greatly exceed"],
  expand: ["expand business", "expand market", "rapidly expand"],
  pursue: ["pursue goal", "pursue career", "pursue happiness"],
  overcome: ["overcome difficulty", "overcome obstacle", "overcome challenge"],
  participate: ["participate in", "actively participate", "participant in"],
  perceive: ["perceive as", "be perceived to", "commonly perceived"],
  predict: ["predict outcome", "difficult to predict", "as predicted"],
};

// ====== 单词池：按学段分级 ======
export const WORD_POOL: Record<EducationLevel, string[]> = {
  primary: [
    "apple", "happy", "friend", "school", "family", "color", "animal", "flower",
    "water", "music", "dance", "paint", "smile", "laugh", "summer", "winter",
    "morning", "evening", "story", "dream", "game", "toy", "bird", "fish",
    "tree", "river", "mountain", "cloud", "rainbow", "star", "moon", "sun",
    "book", "pencil", "table", "chair", "door", "window", "garden", "park",
    "red", "blue", "green", "yellow", "big", "small", "hot", "cold", "fast", "slow",
    "run", "jump", "walk", "swim", "eat", "drink", "sleep", "wake", "play", "sing",
  ],
  junior: [
    "journey", "discover", "adventure", "experience", "challenge", "curious",
    "creative", "confidence", "patience", "grateful", "ambition", "knowledge",
    "culture", "tradition", "community", "environment", "resource", "technology",
    "influence", "achievement", "opportunity", "responsibility", "communication",
    "relationship", "generation", "development", "improvement", "difference",
    "importance", "amazement", "beautiful", "wonderful", "excellent", "terrible",
    "necessary", "possible", "impossible", "comfortable", "familiar", "popular",
    "although", "however", "therefore", "meanwhile", "besides", "instead",
    "suddenly", "recently", "finally", "probably", "especially", "generally",
    "encourage", "support", "appreciate", "apologize", "explain", "describe",
    "compare", "contrast", "predict", "conclude", "prepare", "protect",
  ],
  senior: [
    "phenomenon", "significant", "perspective", "consequence", "circumstance",
    "controversial", "sophisticated", "comprehensive", "substantial", "remarkable",
    "contribution", "interpretation", "assumption", "implication", "demonstration",
    "evaluation", "justification", "clarification", "modification", "application",
    "entrepreneur", "innovation", "sustainability", "globalization", "urbanization",
    "biodiversity", "ecosystem", "atmosphere", "composition", "transformation",
    "hypothesis", "experiment", "observation", "conclusion", "evidence", "theory",
    "persuade", "convince", "analyze", "synthesize", "integrate", "diversify",
    "advocate", "critique", "formulate", "articulate", "elaborate", "illuminate",
    "philosophy", "psychology", "literature", "civilization", "democracy",
    "consciousness", "subconscious", "metaphor", "allegory", "paradox", "dilemma",
  ],
  college: [
    "paradigm", "heuristic", "epistemology", "ontology", "pragmatic", "empirical",
    "deductive", "inductive", "abductive", "axiomatic", "proposition", "inference",
    "syllogism", "dialectic", "hermeneutics", "phenomenology", "existentialism",
    "deconstruction", "postmodernism", "neoliberalism", "intersectionality",
    "hegemony", "subaltern", "diaspora", "cosmopolitan", "multiculturalism",
    "bureaucracy", "meritocracy", "plutocracy", "technocracy", "gerrymandering",
    "jurisprudence", "restitution", "retribution", "precedent", "jurisdiction",
    "contingency", "serendipity", "vicarious", "ephemeral", "pervasive", "tenuous",
    "inexorable", "inscrutable", "sanguine", "phlegmatic", "melancholic", "choleric",
    "quintessential", "ubiquitous", "esoteric", "idiosyncratic", "perspicacious",
  ],
  graduate: [
    "benefit", "advantage", "demand", "economy", "economic", "financial", "market",
    "commercial", "trade", "industry", "investment", "profit", "cost", "expense",
    "employment", "policy", "reform", "technology", "innovation", "device", "system",
    "digital", "data", "research", "experiment", "progress", "advance", "environment",
    "pollution", "protection", "climate", "global", "energy", "resource", "sustainable",
    "damage", "education", "academic", "knowledge", "learning", "skill", "ability",
    "talent", "culture", "tradition", "language", "communication", "behavior", "attitude",
    "health", "medicine", "treatment", "disease", "recovery", "fitness", "nutrition",
    "mental", "psychology", "emotion", "stress", "anxiety", "depression", "government",
    "political", "law", "legal", "justice", "freedom", "democracy", "power", "authority",
    "control", "regulation", "responsibility", "phenomenon", "significant", "perspective",
    "consequence", "circumstance", "controversial", "comprehensive", "substantial",
    "remarkable", "assumption", "implication", "evaluation", "demonstrate", "indicate",
    "interpret", "maintain", "preserve", "resolve", "respond", "reveal", "generate",
    "identify", "illustrate", "impose", "emerge", "enhance", "ensure", "establish",
    "exceed", "expand", "pursue", "overcome", "participate", "perceive", "predict",
  ],
};

export function getRandomWords(level: EducationLevel, count: number = 10): WordItem[] {
  const pool = WORD_POOL[level];
  if (!pool || pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((word) => ({
    word,
    phrases: WORD_PHRASES[word.toLowerCase()],
  }));
}

// ====== 用户学习档案 ======
export interface LearningRecord {
  articleId: string;
  words: string[];
  grammarIds: string[];
  gradeId: string;
  readAt: number;
  sentenceClicks: number;
  timeSpentSeconds: number;
}

export interface UserLearningProfile {
  wordMastery: Record<string, number>;    // 0-100
  grammarMastery: Record<string, number>; // 0-100
  history: LearningRecord[];
  totalArticles: number;
  streakDays: number;
  lastStudyDate: string; // YYYY-MM-DD
}

// ====== 用户单词本 ======
export interface WordBookEntry {
  id: string;
  word: string;
  meaning?: string;
  phrases?: string[];
  proficiency: number; // 0=陌生, 1=认识, 2=熟悉, 3=掌握
  addedAt: number;
  lastReviewedAt: number | null;
  reviewCount: number;
}

// ====== 官方词表 ======
export interface OfficialWordUnit {
  unitId: string;
  unitName: string;
  words: string[];
  grammarIds: string[]; // 该单元涉及的核心语法点
}

export interface OfficialWordGrade {
  gradeId: string;
  gradeName: string;
  units: OfficialWordUnit[];
}

export interface OfficialWordBook {
  id: string;
  name: string;
  publisher: string;
  level: EducationLevel;
  grades: OfficialWordGrade[];
}

// ====== 用户学习进度（教材进度） ======
export interface UserProgress {
  bookId: string;      // 当前教材版本
  gradeId: string;     // 当前年级
  unitId: string;      // 当前单元
  completedUnits: string[]; // 已完成单元ID列表
}

// ====== 单元测验 ======
export interface QuizQuestion {
  id: string;
  type: "word-meaning" | "grammar-fill" | "reading-comprehension";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizResult {
  unitId: string;
  articleId: string;
  score: number;       // 0-100
  totalQuestions: number;
  correctCount: number;
  wrongQuestions: string[]; // 错题 questionId 列表
  completedAt: number;
}
