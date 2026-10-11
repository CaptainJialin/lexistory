import { OfficialWordBook } from "./types";
import { GRADUATE_UNITS } from "./graduate-vocab";

/**
 * 官方教材词表数据
 *
 * 覆盖人教版 PEP 小学（三年级起）、Go for it 初中，以及考研核心词。
 * 每个单元标注核心语法点，用于自动生成文章时匹配语法。
 */

const GRADUATE_STAGE_NAMES = ["考研基础", "考研强化", "考研冲刺"];
const GRADUATE_STAGE_GRADES = ["g1", "g2", "g3"];

/**
 * 考研核心词教材由 lib/graduate-vocab.ts 生成。
 *
 * 手写的话既容易漏，也没法给每个词带释义。词表里自带中文释义，
 * 意味着这些词进单词本时不用再调 /api/enrich-words 补全。
 */
function buildGraduateCoreBook(): OfficialWordBook {
  return {
    id: "graduate-core",
    name: "考研英语核心词",
    publisher: "考研高频词汇",
    level: "graduate",
    grades: GRADUATE_UNITS.map((units, stageIdx) => ({
      gradeId: GRADUATE_STAGE_GRADES[stageIdx],
      gradeName: GRADUATE_STAGE_NAMES[stageIdx],
      units: units.map((unit) => ({
        unitId: unit.id,
        unitName: unit.name,
        words: unit.words.map((w) => w.w),
        grammarIds: unit.grammarIds,
      })),
    })),
  };
}

export const OFFICIAL_WORD_BOOKS: OfficialWordBook[] = [
  // ========== 人教版 PEP 小学 ==========
  {
    id: "pep-primary",
    name: "人教版 PEP",
    publisher: "人民教育出版社",
    level: "primary",
    grades: [
      {
        gradeId: "p3",
        gradeName: "三年级",
        units: [
          {
            unitId: "p3-u1",
            unitName: "Unit 1 Hello!",
            words: [
              "hello", "hi", "name", "goodbye", "bye", "Miss", "class",
              "I", "am", "nice", "meet", "you", "too",
            ],
            grammarIds: ["simple-present", "pronouns"],
          },
          {
            unitId: "p3-u2",
            unitName: "Unit 2 Colours!",
            words: [
              "red", "green", "yellow", "blue", "black", "brown", "white",
              "orange", "OK", "mum", "dad",
            ],
            grammarIds: ["simple-present", "pronouns"],
          },
          {
            unitId: "p3-u3",
            unitName: "Unit 3 Look at me!",
            words: [
              "face", "ear", "eye", "nose", "mouth", "arm", "hand",
              "head", "body", "leg", "foot", "school",
            ],
            grammarIds: ["simple-present", "imperative"],
          },
          {
            unitId: "p3-u4",
            unitName: "Unit 4 We love animals",
            words: [
              "duck", "pig", "cat", "bear", "dog", "elephant", "monkey",
              "bird", "tiger", "panda", "zoo", "funny",
            ],
            grammarIds: ["simple-present", "noun-plural"],
          },
          {
            unitId: "p3-u5",
            unitName: "Unit 5 Let's eat!",
            words: [
              "bread", "juice", "egg", "milk", "water", "cake", "fish",
              "rice", "drink", "eat", "have",
            ],
            grammarIds: ["simple-present", "imperative"],
          },
          {
            unitId: "p3-u6",
            unitName: "Unit 6 Happy birthday!",
            words: [
              "one", "two", "three", "four", "five", "six", "seven",
              "eight", "nine", "ten", "birthday", "happy", "old", "how",
            ],
            grammarIds: ["simple-present", "numerals"],
          },
        ],
      },
      {
        gradeId: "p4",
        gradeName: "四年级",
        units: [
          {
            unitId: "p4-u1",
            unitName: "Unit 1 My classroom",
            words: [
              "classroom", "window", "blackboard", "light", "picture",
              "door", "teacher", "desk", "chair", "floor", "clean", "near",
            ],
            grammarIds: ["simple-present", "there-be"],
          },
          {
            unitId: "p4-u2",
            unitName: "Unit 2 My schoolbag",
            words: [
              "schoolbag", "maths", "English", "Chinese", "storybook",
              "candy", "notebook", "toy", "key", "lost", "cute", "so much",
            ],
            grammarIds: ["simple-present", "prepositions"],
          },
          {
            unitId: "p4-u3",
            unitName: "Unit 3 My friends",
            words: [
              "strong", "friendly", "quiet", "hair", "shoe", "glasses",
              "his", "her", "or", "right", "hat",
            ],
            grammarIds: ["simple-present", "pronouns"],
          },
          {
            unitId: "p4-u4",
            unitName: "Unit 4 My home",
            words: [
              "bedroom", "living", "room", "study", "kitchen", "bathroom",
              "bed", "phone", "table", "sofa", "fridge", "find",
            ],
            grammarIds: ["simple-present", "prepositions", "there-be"],
          },
          {
            unitId: "p4-u5",
            unitName: "Unit 5 Dinner's ready",
            words: [
              "beef", "chicken", "noodles", "soup", "vegetable", "chopsticks",
              "bowl", "fork", "knife", "spoon", "dinner", "ready",
            ],
            grammarIds: ["simple-present", "imperative"],
          },
          {
            unitId: "p4-u6",
            unitName: "Unit 6 Meet my family!",
            words: [
              "family", "parents", "uncle", "aunt", "baby", "cousin",
              "doctor", "cook", "driver", "farmer", "nurse", "people",
            ],
            grammarIds: ["simple-present", "noun-plural"],
          },
        ],
      },
      {
        gradeId: "p5",
        gradeName: "五年级",
        units: [
          {
            unitId: "p5-u1",
            unitName: "Unit 1 What's he like?",
            words: [
              "old", "young", "funny", "kind", "strict", "polite",
              "hard-working", "helpful", "clever", "shy", "know", "our",
            ],
            grammarIds: ["simple-present", "pronouns"],
          },
          {
            unitId: "p5-u2",
            unitName: "Unit 2 My week",
            words: [
              "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
              "Saturday", "Sunday", "weekend", "wash", "watch", "do",
              "read", "play", "cooking", "often", "park", "tired", "sport",
            ],
            grammarIds: ["simple-present"],
          },
          {
            unitId: "p5-u3",
            unitName: "Unit 3 What would you like?",
            words: [
              "sandwich", "salad", "hamburger", "ice cream", "tea", "fresh",
              "healthy", "delicious", "hot", "sweet", "drink", "thirsty",
              "favourite", "food",
            ],
            grammarIds: ["simple-present", "infinitive"],
          },
          {
            unitId: "p5-u4",
            unitName: "Unit 4 What can you do?",
            words: [
              "dance", "sing", "song", "kung fu", "draw", "cartoon",
              "cook", "swim", "play", "pipa", "speak", "English", "party",
              "wonderful", "learn", "any", "problem",
            ],
            grammarIds: ["simple-present"],
          },
          {
            unitId: "p5-u5",
            unitName: "Unit 5 There is a big bed",
            words: [
              "clock", "plant", "bottle", "water", "bike", "photo",
              "front", "in", "between", "above", "behind", "beside",
              "grandparent", "their", "house", "lot", "flower", "move",
            ],
            grammarIds: ["there-be", "prepositions"],
          },
          {
            unitId: "p5-u6",
            unitName: "Unit 6 In a nature park",
            words: [
              "forest", "river", "lake", "mountain", "hill", "tree",
              "bridge", "building", "village", "city", "house", "road",
              "boating", "go", "nature", "park",
            ],
            grammarIds: ["there-be", "prepositions"],
          },
        ],
      },
      {
        gradeId: "p6",
        gradeName: "六年级",
        units: [
          {
            unitId: "p6-u1",
            unitName: "Unit 1 How can I get there?",
            words: [
              "science", "museum", "post office", "bookstore", "cinema",
              "hospital", "crossing", "turn", "left", "right", "straight",
              "asking", "sir",
            ],
            grammarIds: ["simple-present", "imperative", "prepositions"],
          },
          {
            unitId: "p6-u2",
            unitName: "Unit 2 Ways to go to school",
            words: [
              "on foot", "by", "bus", "plane", "taxi", "ship", "subway",
              "train", "slow", "down", "stop", "Mrs", "early", "helmet",
              "must", "wear", "attention", "traffic", "light",
            ],
            grammarIds: ["simple-present", "prepositions"],
          },
          {
            unitId: "p6-u3",
            unitName: "Unit 3 My weekend plan",
            words: [
              "visit", "film", "see", "trip", "supermarket", "evening",
              "tonight", "tomorrow", "next", "week", "dictionary", "comic",
              "word", "postcard", "lesson", "space", "travel", "half",
              "price", "together", "moon",
            ],
            grammarIds: ["simple-future", "simple-present"],
          },
          {
            unitId: "p6-u4",
            unitName: "Unit 4 I have a pen pal",
            words: [
              "hobby", "ride", "dive", "live", "studies", "puzzle", "hiking",
              "jasmine", "idea", "Canberra", "amazing", "shall", "goal",
              "join", "club", "share",
            ],
            grammarIds: ["simple-present", "gerund"],
          },
          {
            unitId: "p6-u5",
            unitName: "Unit 5 What does he do?",
            words: [
              "factory", "worker", "postman", "businessman", "police",
              "officer", "fisherman", "scientist", "pilot", "coach",
              "country", "head", "sea", "stay", "university", "gym",
              "if", "reporter", "use", "type", "quickly",
            ],
            grammarIds: ["simple-present"],
          },
          {
            unitId: "p6-u6",
            unitName: "Unit 6 How do you feel?",
            words: [
              "angry", "afraid", "sad", "worried", "happy", "see",
              "doctor", "do", "more", "deep", "breath", "count", "to",
              "ten", "wrong", "should", "feel", "well", "sit", "grass",
              "hear", "ant", "worry", "stuck", "mud", "pull", "everyone",
            ],
            grammarIds: ["simple-present", "imperative"],
          },
        ],
      },
    ],
  },

  // ========== 人教版 Go for it 初中 ==========
  {
    id: "pep-junior",
    name: "人教版 Go for it",
    publisher: "人民教育出版社",
    level: "junior",
    grades: [
      {
        gradeId: "j1",
        gradeName: "七年级上册",
        units: [
          {
            unitId: "j1-u1",
            unitName: "Unit 1 My name's Gina.",
            words: [
              "name", "nice", "meet", "too", "your", "Ms.", "his", "and",
              "her", "yes", "she", "he", "no", "not", "zero", "one", "two",
              "three", "four", "five", "six", "seven", "eight", "nine",
              "telephone", "number", "phone", "first", "last", "friend",
              "China",
            ],
            grammarIds: ["simple-present", "pronouns"],
          },
          {
            unitId: "j1-u2",
            unitName: "Unit 2 This is my sister.",
            words: [
              "sister", "mother", "father", "parent", "brother",
              "grandmother", "grandfather", "grandparent", "family",
              "those", "who", "these", "they", "well", "have", "day",
              "bye", "son", "cousin", "grandpa", "grandma", "mom", "dad",
              "uncle", "aunt", "daughter", "here", "photo", "of", "next",
              "picture", "girl", "dog",
            ],
            grammarIds: ["simple-present", "pronouns"],
          },
          {
            unitId: "j1-u3",
            unitName: "Unit 3 Is this your pencil?",
            words: [
              "pencil", "book", "eraser", "box", "schoolbag", "dictionary",
              "his", "mine", "hers", "yours", "theirs", "ours", "excuse",
              "me", "thank", "teacher", "about", "yours", "for", "help",
              "welcome",
            ],
            grammarIds: ["simple-present", "pronouns"],
          },
          {
            unitId: "j1-u4",
            unitName: "Unit 4 Where's my schoolbag?",
            words: [
              "where", "table", "bed", "bookcase", "sofa", "chair",
              "on", "under", "come", "desk", "think", "room", "hat",
              "head", "know", "radio", "clock", "tape", "player", "model",
              "plane", "tidy", "but", "our", "everywhere", "always",
            ],
            grammarIds: ["prepositions", "there-be", "simple-present"],
          },
          {
            unitId: "j1-u5",
            unitName: "Unit 5 Do you have a soccer ball?",
            words: [
              "do", "have", "tennis", "ball", "ping-pong", "bat",
              "soccer", "volleyball", "basketball", "let", "us", "go",
              "we", "late", "get", "great", "play", "sound", "interesting",
              "boring", "fun", "difficult", "relaxing", "watch", "TV",
              "same", "love", "with", "sport", "them", "only", "like",
              "easy", "after", "class", "classmate",
            ],
            grammarIds: ["simple-present"],
          },
          {
            unitId: "j1-u6",
            unitName: "Unit 6 Do you like bananas?",
            words: [
              "banana", "hamburger", "tomato", "ice-cream", "salad",
              "strawberry", "pear", "milk", "bread", "birthday", "dinner",
              "week", "think", "food", "sure", "How", "about", "burger",
              "vegetable", "fruit", "right", "apple", "then", "egg",
              "carrot", "rice", "chicken", "so", "breakfast", "lunch",
              "star", "eat", "well", "habit", "healthy", "really",
              "question", "want", "be", "fat",
            ],
            grammarIds: ["simple-present", "noun-plural"],
          },
        ],
      },
      {
        gradeId: "j2",
        gradeName: "八年级上册",
        units: [
          {
            unitId: "j2-u1",
            unitName: "Unit 1 Where did you go on vacation?",
            words: [
              "anyone", "anywhere", "wonderful", "few", "quite", "most",
              "something", "nothing", "everyone", "myself", "yourself",
              "hen", "pig", "seem", "bored", "someone", "diary", "activity",
              "decide", "try", "bird", "paragliding", "bicycle", "building",
              "trader", "wonder", "difference", "top", "wait", "umbrella",
              "wet", "because of", "below", "enough", "hungry", "as",
              "hill", "duck", "dislike",
            ],
            grammarIds: ["simple-past", "pronouns"],
          },
          {
            unitId: "j2-u2",
            unitName: "Unit 2 How often do you exercise?",
            words: [
              "housework", "hardly", "ever", "once", "twice", "Internet",
              "program", "full", "swing", "maybe", "least", "junk",
              "coffee", "health", "result", "percent", "online",
              "television", "although", "through", "mind", "body",
              "such", "together", "die", "writer",
            ],
            grammarIds: ["simple-present"],
          },
          {
            unitId: "j2-u3",
            unitName: "Unit 3 I'm more outgoing than my sister.",
            words: [
              "outgoing", "better", "loudly", "quietly", "hard-working",
              "competition", "fantastic", "which", "clearly", "win",
              "though", "talented", "truly", "care", "care about", "serious",
              "mirror", "kid", "as long as", "necessary", "be different from",
              "both", "bring", "grade", "should", "the same as", "saying",
              "reach", "hand", "touch", "heart", "fact", "in fact",
              "break", "arm", "share", "similar", "primary",
            ],
            grammarIds: ["comparative-superlative", "simple-present", "adverbial-clauses-condition"],
          },
          {
            unitId: "j2-u4",
            unitName: "Unit 4 What's the best movie theater?",
            words: [
              "theater", "comfortable", "seat", "screen", "close", "ticket",
              "worst", "cheaply", "song", "DJ", "choose", "carefully",
              "reporter", "so far", "fresh", "comfortably", "no problem",
              "worse", "service", "pretty", "menu", "act", "meal", "creative",
              "performer", "talent", "common", "magician", "beautifully",
              "role", "winner", "prize", "everybody", "example", "poor",
              "seriously", "give",
            ],
            grammarIds: ["comparative-superlative", "simple-present"],
          },
          {
            unitId: "j2-u5",
            unitName: "Unit 5 Do you want to watch a game show?",
            words: [
              "sitcom", "news", "soap", "educational", "plan", "hope",
              "discussion", "stand", "happen", "may", "expect", "joke",
              "comedy", "meaningless", "action", "cartoon", "culture",
              "famous", "appear", "become", "rich", "successful", "might",
              "main", "reason", "film", "unlucky", "lose", "ready", "simple",
              "army",
            ],
            grammarIds: ["simple-present", "infinitive"],
          },
          {
            unitId: "j2-u6",
            unitName: "Unit 6 I'm going to study computer science.",
            words: [
              "grow", "computer", "programmer", "cook", "doctor", "engineer",
              "violinist", "driver", "pilot", "pianist", "scientist",
              "be sure about", "make sure", "college", "education", "medicine",
              "university", "article", "send", "resolution", "team", "foreign",
              "able", "be able to", "question", "meaning", "discuss",
              "promise", "beginning", "at the beginning of", "improve",
              "write down", "physical", "themselves", "hobby", "weekly",
              "schoolwork", "agree", "agree with", "personal",
            ],
            grammarIds: ["simple-future", "infinitive"],
          },
        ],
      },
      {
        gradeId: "j3",
        gradeName: "九年级",
        units: [
          {
            unitId: "j3-u1",
            unitName: "Unit 1 How can we become good learners?",
            words: [
              "textbook", "conversation", "aloud", "pronunciation", "sentence",
              "patient", "expression", "discover", "secret", "look up",
              "grammar", "repeat", "note", "pal", "physics", "chemistry",
              "memorize", "pattern", "pronounce", "increase", "speed",
              "partner", "born", "ability", "create", "brain", "active",
              "attention", "pay attention to", "connect", "review",
              "knowledge", "lifelong", "wisely",
            ],
            grammarIds: ["simple-present", "gerund"],
          },
          {
            unitId: "j3-u2",
            unitName: "Unit 2 I think that mooncakes are delicious!",
            words: [
              "stranger", "relative", "pound", "put on", "gain", "weight",
              "wish", "accept", "treat", "Christmas", "lie", "novel",
              "eve", "dead", "business", "punish", "warn", "present",
              "nobody", "warmth", "spread", "steal", "lay", "spread-laid",
            ],
            grammarIds: ["noun-clauses",  "passive-voice"],
          },
          {
            unitId: "j3-u3",
            unitName: "Unit 3 Could you please tell me where the restrooms are?",
            words: [
              "restroom", "stamp", "bookstore", "beside", "postcard",
              "pardon", "washroom", "bathroom", "normally", "rush", "suggest",
              "staff", "grape", "central", "mail", "east", "fascinating",
              "convenient", "mall", "clerk", "corner", "polite", "speak",
              "direction", "correct", "direct", "whom", "request", "command",
            ],
            grammarIds: ["noun-clauses", "simple-present", "imperative"],
          },
          {
            unitId: "j3-u4",
            unitName: "Unit 4 I used to be afraid of the dark.",
            words: [
              "humorous", "silent", "helpful", "score", "background",
              "interview", "Asian", "deal", "dare", "private", "guard",
              "require", "European", "British", "speech", "public", "ant",
              "insect", "influence", "examination", "pride", "introduction",
            ],
            grammarIds: ["simple-past", "prepositions"],
          },
          {
            unitId: "j3-u5",
            unitName: "Unit 5 What are the shirts made of?",
            words: [
              "chopsticks", "coin", "fork", "blouse", "silver", "glass",
              "cotton", "steel", "grass", "leaf", "produce", "widely",
              "process", "pack", "product", "France", "local", "brand",
              "avoid", "handbag", "mobile", "everyday", "boss", "surface",
              "material", "traffic", "postman", "glove", "international",
              "competitor", "form", "balloon", "scissors", "heat", "polish",
              "complete",
            ],
            grammarIds: ["passive-voice", "prepositions"],
          },
          {
            unitId: "j3-u6",
            unitName: "Unit 6 When was it invented?",
            words: [
              "heel", "scoop", "electricity", "style", "project", "pleasure",
              "zipper", "daily", "website", "pioneer", "list", "mention",
              "accidental", "by accident", "nearly", "boil", "smell",
              "saint", "trade", "take place", "doubt", "without doubt",
              "fridge", "low", "somebody", "translate", "lock", "earthquake",
              "sudden", "bell", "biscuit", "cookie", "musical", "instrument",
              "crispy", "salty", "sour", "by mistake", "customer", "Canadian",
              "divide", "basket", "popularity", "not only...but also",
            ],
            grammarIds: ["passive-voice", "simple-past"],
          },
        ],
      },
    ],
  },

  // ========== 考研英语 ==========
  // 注意：本书曾错标为 id="pep-senior" / gradeId=s1,s2,s3（与 GRADE_OPTIONS 中
  // 表示高一/高二/高三的 s1-s3 冲突），已更正为考研学段的 g1-g3。
  // 旧数据由 lib/migrate.ts 的 LEGACY_ID_MAP 改写。
  {
    id: "graduate-exam",
    name: "考研英语大纲",
    publisher: "考研大纲",
    level: "graduate",
    grades: [
      {
        gradeId: "g1",
        gradeName: "考研基础",
        units: [
          {
            unitId: "ge-g1-u1",
            unitName: "考研基础 - 每日练习",
            words: [
              "prefer", "content", "movement", "suitable", "actually",
              "challenge", "opportunity", "obviously", "quit", "responsible",
              "solution", "encourage", "advance", "obtain", "attract",
              "focus", "addicted", "adult", "accustomed", "gradual",
            ],
            grammarIds: ["simple-present", "simple-past", "infinitive"],
          },
          {
            unitId: "ge-g1-u2",
            unitName: "考研基础 - 每日练习",
            words: [
              "apply", "visa", "rent", "pack", "amazing", "flight",
              "accommodation", "unique", "destination", "contact", "culture",
              "site", "check in", "check out", "credit", "detail", "confirm",
              "book", "agent", "announce", "tongue", "journey", "eagle",
            ],
            grammarIds: ["present-continuous", "gerund"],
          },
        ],
      },
      {
        gradeId: "g2",
        gradeName: "考研强化",
        units: [
          {
            unitId: "ge-g2-u1",
            unitName: "考研强化 - 每日练习",
            words: [
              "heritage", "creative", "preserve", "promote", "application",
              "balance", "propose", "prevent", "establish", "limit",
              "contribution", "fund", "within", "investigate", "issue",
              "conduct", "document", "donate", "disappear", "attempt",
              "worthwhile", "download", "republic", "process", "overseas",
            ],
            grammarIds: ["passive-voice", "relative-clauses"],
          },
        ],
      },
      {
        gradeId: "g3",
        gradeName: "考研冲刺",
        units: [
          {
            unitId: "ge-g3-u1",
            unitName: "考研冲刺 - 每日练习",
            words: [
              "festival", "lantern", "carnival", "costume", "march",
              "congratulation", "riddle", "ceremony", "samba", "makeup",
              "after all", "range", "origin", "religion", "religious",
              "figure", "charm", "joy", "gratitude", "harvest", "agricultural",
              "crop", "gather", "grateful", "feature", "decorate", "church",
              "significant", "faith", "commercial", "commercialize", "attract",
              "attractive", "display",
            ],
            grammarIds: ["passive-voice", "relative-clauses", "infinitive"],
          },
        ],
      },
    ],
  },
  // ========== 考研英语核心词 ==========
  // 由 lib/graduate-vocab.ts 生成——原来手写的 18 单元只有 360 词，
  // 二十几篇文章就读完了。现在 30 单元 750 词，且每个词自带释义。
  buildGraduateCoreBook(),
];

// ====== 查询函数 ======

export function getAllBooks(): OfficialWordBook[] {
  return OFFICIAL_WORD_BOOKS;
}

export function getWordBookById(id: string): OfficialWordBook | undefined {
  return OFFICIAL_WORD_BOOKS.find((b) => b.id === id);
}

export function getGradesByBook(bookId: string) {
  const book = getWordBookById(bookId);
  return book?.grades ?? [];
}

export function getUnitsByGrade(
  bookId: string,
  gradeId: string
) {
  const book = getWordBookById(bookId);
  if (!book) return [];
  const grade = book.grades.find((g) => g.gradeId === gradeId);
  return grade?.units ?? [];
}

export function getUnitById(
  bookId: string,
  gradeId: string,
  unitId: string
) {
  const units = getUnitsByGrade(bookId, gradeId);
  return units.find((u) => u.unitId === unitId);
}

export function getWordsByUnit(
  bookId: string,
  gradeId: string,
  unitId: string
): string[] {
  const unit = getUnitById(bookId, gradeId, unitId);
  return unit?.words ?? [];
}

export function getGrammarIdsByUnit(
  bookId: string,
  gradeId: string,
  unitId: string
): string[] {
  const unit = getUnitById(bookId, gradeId, unitId);
  return unit?.grammarIds ?? [];
}

export function getAllWordsByGrade(
  bookId: string,
  gradeId: string
): string[] {
  const units = getUnitsByGrade(bookId, gradeId);
  return units.flatMap((u) => u.words);
}

/** 获取某教材某年级下，从当前单元开始往后 N 个单元的单词 */
export function getRecommendedUnitWords(
  bookId: string,
  gradeId: string,
  learnedWords: Set<string>,
  count: number = 10
): string[] {
  const units = getUnitsByGrade(bookId, gradeId);
  const result: string[] = [];

  for (const unit of units) {
    const newWords = unit.words.filter((w) => !learnedWords.has(w.toLowerCase()));
    result.push(...newWords);
    if (result.length >= count) break;
  }

  return result.slice(0, count);
}

/** 获取下一个单元 */
export function getNextUnit(
  bookId: string,
  gradeId: string,
  currentUnitId: string
) {
  const units = getUnitsByGrade(bookId, gradeId);
  const idx = units.findIndex((u) => u.unitId === currentUnitId);
  if (idx === -1 || idx >= units.length - 1) return null;
  return units[idx + 1];
}

/** 获取上一个单元 */
export function getPrevUnit(
  bookId: string,
  gradeId: string,
  currentUnitId: string
) {
  const units = getUnitsByGrade(bookId, gradeId);
  const idx = units.findIndex((u) => u.unitId === currentUnitId);
  if (idx <= 0) return null;
  return units[idx - 1];
}
