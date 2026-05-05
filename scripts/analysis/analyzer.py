"""
高考英语阅读文本分析器
功能：
1. 读取文章数据（JSON）
2. 分词、统计词频
3. 识别短语搭配和用法
4. 与高中词汇表对比
5. 生成高频词、短语、用法报告
"""
import json
import os
import re
import string
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class Article:
    """文章数据结构（与爬虫模块保持一致）"""
    id: str
    title: str
    content: str
    source: str
    source_url: str
    year: Optional[int] = None
    exam_type: Optional[str] = None
    article_type: Optional[str] = None
    tags: List[str] = None
    fetched_at: str = ""

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


@dataclass
class WordAnalysis:
    """单词分析结果"""
    word: str
    frequency: int
    meanings: List[str]  # 常见含义（从词库匹配）
    collocations: List[str]  # 常见搭配
    example_sentences: List[str]  # 例句（从文章中提取）
    pos_hint: str  # 词性提示（简单推断）


@dataclass
class AnalysisReport:
    """分析报告"""
    total_articles: int
    total_words: int
    unique_words: int
    top_words: List[WordAnalysis]
    top_phrases: List[Tuple[str, int]]
    word_by_pos: Dict[str, List[str]]  # 按词性分类
    coverage_vs_cet: Dict[str, float]  # 与高中词汇覆盖率
    difficulty_distribution: Dict[str, int]  # 难度分布


class TextAnalyzer:
    """文本分析器"""

    # 高中核心词汇表（3500词精简版 - 高频核心约1500个）
    # 这里用最常见的核心词汇作为基准
    CORE_VOCABULARY = {
        # 最核心高频词（几乎每个高考文章都会出现）
        "ability", "able", "about", "above", "abroad", "absence", "absent", "accept",
        "accident", "according", "account", "ache", "achieve", "achievement", "across",
        "act", "action", "active", "activity", "actor", "actress", "actual", "add",
        "address", "admire", "admit", "adult", "advance", "advantage", "adventure",
        "advertise", "advice", "advise", "affair", "affect", "afford", "afraid",
        "Africa", "African", "after", "afternoon", "again", "against", "age", "agency",
        "agent", "ago", "agree", "agreement", "ahead", "aid", "aim", "air", "aircraft",
        "airline", "airport", "alarm", "alive", "all", "allow", "almost", "alone",
        "along", "aloud", "already", "also", "although", "altogether", "always",
        "amaze", "ambition", "America", "American", "among", "amount", "amuse",
        "ancient", "and", "anger", "angle", "angry", "animal", "announce", "annoy",
        "another", "answer", "anxious", "any", "anybody", "anyhow", "anyone", "anything",
        "anyway", "anywhere", "apart", "apologize", "apparent", "appeal", "appear",
        "appearance", "appetite", "applaud", "apple", "applicant", "apply", "appoint",
        "appreciate", "approach", "appropriate", "approve", "approximately", "April",
        "Arab", "arch", "architect", "architecture", "area", "argue", "arise", "arm",
        "army", "around", "arrange", "arrest", "arrival", "arrive", "arrow", "art",
        "article", "artificial", "artist", "as", "ash", "ashamed", "Asia", "Asian",
        "aside", "ask", "asleep", "aspect", "assess", "assist", "assistant", "associate",
        "association", "assume", "assure", "astonish", "astronaut", "astronomer",
        "at", "athlete", "Atlantic", "atmosphere", "atom", "attach", "attack",
        "attain", "attempt", "attend", "attention", "attitude", "attract", "attraction",
        "attractive", "audience", "August", "aunt", "Australia", "Australian", "author",
        "authority", "automatic", "autumn", "available", "avenue", "average", "avoid",
        "awake", "award", "aware", "away", "awesome", "awful", "awkward",
        # B 开头
        "baby", "back", "background", "backward", "bacon", "bad", "badminton", "bag",
        "bake", "balance", "balcony", "ball", "ballet", "balloon", "ban", "banana",
        "band", "bank", "bar", "barbecue", "barber", "bare", "bargain", "bark",
        "barrier", "base", "baseball", "basement", "basic", "basin", "basis", "basket",
        "basketball", "bat", "bath", "bathe", "bathroom", "bathtub", "battery", "battle",
        "bay", "be", "beach", "bean", "bear", "beard", "beast", "beat", "beautiful",
        "beauty", "because", "become", "bed", "bedroom", "bee", "beef", "beer",
        "before", "beg", "begin", "behalf", "behave", "behaviour", "behind", "being",
        "belief", "believe", "bell", "belong", "below", "belt", "bench", "bend",
        "beneath", "beneficial", "benefit", "beside", "besides", "best", "betray",
        "better", "between", "beyond", "bicycle", "big", "bike", "bill", "billion",
        "bind", "biography", "biology", "bird", "birth", "birthday", "biscuit",
        "bit", "bite", "bitter", "black", "blackboard", "blame", "blank", "blanket",
        "blind", "block", "blood", "blow", "blue", "board", "boat", "body", "boil",
        "bomb", "bond", "bone", "bonus", "book", "boom", "boot", "border", "bore",
        "bored", "boring", "born", "borrow", "boss", "both", "bother", "bottle",
        "bottom", "bounce", "bound", "boundary", "bow", "bowl", "bowling", "box",
        "boy", "brain", "brake", "branch", "brand", "brave", "bread", "break",
        "breakfast", "breath", "breathe", "breed", "brick", "bride", "bridge",
        "brief", "bright", "brilliant", "bring", "Britain", "British", "broad",
        "broadcast", "brochure", "brother", "brown", "brush", "bubble", "budget",
        "buffet", "build", "building", "bunch", "burn", "burst", "bury", "bus",
        "bush", "business", "busy", "but", "butcher", "butter", "butterfly", "button",
        "buy", "by", "bye",
        # C 开头
        "cab", "cabbage", "cabin", "cafe", "cafeteria", "cage", "cake", "calculate",
        "call", "calm", "camel", "camera", "camp", "campaign", "can", "canal", "cancel",
        "cancer", "candidate", "candle", "candy", "canteen", "cap", "capable",
        "capacity", "capital", "capsule", "captain", "car", "carbon", "card", "care",
        "career", "careful", "careless", "carpenter", "carpet", "carrot", "carry",
        "cartoon", "carve", "case", "cash", "cassette", "cast", "castle", "casual",
        "cat", "catch", "category", "cater", "cattle", "cause", "caution", "cautious",
        "cave", "ceiling", "celebrate", "celebrity", "cell", "cent", "centre", "century",
        "ceremony", "certain", "certificate", "chain", "chair", "chairman", "challenge",
        "challenging", "champion", "chance", "change", "channel", "chant", "chaos",
        "chapter", "character", "characteristic", "charge", "charity", "charm",
        "chart", "chat", "cheap", "cheat", "check", "cheek", "cheer", "cheerful",
        "cheese", "chef", "chemical", "chemist", "chemistry", "cheque", "chess",
        "chest", "chew", "chicken", "chief", "child", "childhood", "chocolate",
        "choice", "choir", "choke", "choose", "chop", "chopsticks", "chorus",
        "Christian", "Christmas", "church", "cigar", "cigarette", "cinema", "circle",
        "circuit", "circulate", "circumstance", "circus", "cite", "citizen", "city",
        "civil", "civilian", "civilization", "claim", "clap", "clarify", "class",
        "classic", "classify", "classmate", "classroom", "clause", "claw", "clay",
        "clean", "cleaner", "clear", "clerk", "clever", "click", "client", "cliff",
        "climate", "climb", "clinic", "clock", "clone", "close", "cloth", "clothes",
        "clothing", "cloud", "cloudy", "club", "clue", "clumsy", "coach", "coal",
        "coast", "coat", "cock", "cocktail", "code", "coffee", "coin", "coincidence",
        "cold", "collar", "colleague", "collect", "collection", "college", "collision",
        "colour", "comb", "combination", "combine", "come", "comedy", "comfort",
        "comfortable", "command", "comment", "commercial", "commit", "commitment",
        "committee", "common", "communicate", "communication", "communism", "communist",
        "companion", "company", "compare", "compass", "compensate", "compete",
        "competence", "competition", "complete", "complex", "component", "compose",
        "composition", "comprehension", "compromise", "compulsory", "computer",
        "concentrate", "concept", "concern", "concert", "conclude", "conclusion",
        "concrete", "condition", "conduct", "conference", "confident", "confirm",
        "conflict", "confuse", "congratulate", "connection", "conscience", "consensus",
        "consequence", "conservation", "conservative", "consider", "considerate",
        "consideration", "consist", "consistent", "constant", "constitution",
        "construct", "construction", "consult", "consultant", "consume", "contain",
        "container", "contemporary", "content", "continent", "continue", "contradict",
        "contrary", "contribute", "contribution", "control", "controversial",
        "convenience", "convenient", "conventional", "conversation", "convey",
        "convince", "cook", "cooker", "cookie", "cool", "cooperate", "cope", "copy",
        "corn", "corner", "corporation", "correct", "correspond", "corrupt", "cost",
        "cottage", "cotton", "cough", "could", "council", "count", "counter",
        "country", "countryside", "county", "couple", "courage", "course", "court",
        "courtyard", "cousin", "cover", "cow", "crash", "crayon", "crazy", "cream",
        "create", "creature", "credit", "crew", "crime", "criminal", "crisis",
        "criterion", "critic", "critical", "criticism", "crocodile", "crop", "cross",
        "crossing", "crossroads", "crowd", "cruel", "cry", "cube", "cuisine", "culture",
        "cup", "cupboard", "cure", "curious", "currency", "curriculum", "curtain",
        "cushion", "custom", "customer", "customs", "cut", "cycle", "cyclist",
        # D 开头
        "dad", "daily", "dam", "damage", "damp", "dance", "danger", "dangerous",
        "dare", "dark", "dash", "data", "database", "date", "daughter", "dawn", "day",
        "dead", "deadline", "deaf", "deal", "dear", "death", "debate", "debt",
        "decade", "decide", "decision", "declare", "decline", "decorate", "decrease",
        "deed", "deep", "deer", "defeat", "defence", "defend", "degree", "delay",
        "delete", "deliberately", "delicate", "delicious", "delight", "delighted",
        "deliver", "demand", "dentist", "deny", "depart", "department", "departure",
        "depend", "deposit", "depth", "describe", "description", "desert", "deserve",
        "design", "desire", "desk", "desperate", "despite", "dessert", "destination",
        "destroy", "detective", "determination", "determine", "develop", "development",
        "devote", "devotion", "diagram", "dial", "dialogue", "diamond", "diary",
        "dictation", "dictionary", "die", "diet", "differ", "difference", "different",
        "difficult", "difficulty", "dig", "digest", "digital", "dignity", "dilemma",
        "dimension", "dinner", "dinosaur", "dioxide", "dip", "diploma", "direct",
        "direction", "director", "directory", "dirty", "disability", "disabled",
        "disadvantage", "disagree", "disappear", "disappoint", "disaster", "disc",
        "discard", "discipline", "discount", "discourage", "discover", "discovery",
        "discriminate", "discuss", "discussion", "disease", "disgusting", "dish",
        "disk", "dismiss", "display", "distance", "distant", "distinction",
        "distinguish", "distribute", "district", "disturb", "dive", "diverse",
        "divide", "division", "divorce", "dizzy", "do", "doctor", "document",
        "dog", "doll", "dollar", "donate", "donation", "donkey", "door", "dormitory",
        "dot", "double", "doubt", "down", "download", "downstairs", "downtown",
        "draft", "drag", "draw", "drawback", "drawer", "dream", "dress", "drill",
        "drink", "drive", "driver", "drop", "drown", "drug", "drum", "drunk", "dry",
        "duck", "due", "dull", "dumpling", "during", "dusk", "dust", "dustbin",
        "dusty", "duty", "DVD", "dynamic", "dynasty",
        # E 开头
        "each", "eager", "eagle", "ear", "early", "earn", "earth", "earthquake",
        "east", "eastern", "easy", "eat", "ecology", "edge", "edition", "editor",
        "educate", "education", "educator", "effect", "effort", "egg", "eggplant",
        "either", "elder", "elect", "electric", "electrical", "electricity",
        "electronic", "elegant", "element", "elephant", "else", "e-mail", "embarrass",
        "emergency", "emperor", "employ", "empty", "encourage", "encouragement",
        "end", "ending", "enemy", "energetic", "energy", "engine", "engineer",
        "enjoy", "enjoyable", "enlarge", "enough", "enquiry", "ensure", "enter",
        "enterprise", "entertainment", "enthusiastic", "entire", "entrance", "entry",
        "envelope", "environment", "envy", "equal", "equality", "equip", "equipment",
        "era", "erase", "error", "erupt", "escape", "especially", "essay", "Europe",
        "European", "evaluate", "even", "evening", "event", "eventually", "ever",
        "every", "everybody", "everyday", "everyone", "everything", "everywhere",
        "evidence", "evident", "evil", "evolution", "exact", "exam", "examine",
        "example", "excellent", "except", "exchange", "excite", "excuse", "exercise",
        "exhibition", "exist", "existence", "exit", "expand", "expansion", "expect",
        "expectation", "expense", "expensive", "experience", "experiment", "expert",
        "explain", "explanation", "explicit", "explode", "explore", "export",
        "expose", "express", "expression", "extend", "extension", "extra",
        "extraordinary", "extreme", "eye", "eyesight",
        # F 开头
        "face", "facial", "fact", "factory", "fade", "fail", "failure", "fair",
        "faith", "fall", "false", "familiar", "family", "famous", "fan", "fancy",
        "fantastic", "far", "fare", "farm", "farmer", "fast", "fasten", "fat",
        "father", "fault", "favour", "favourite", "fax", "fear", "feast", "feather",
        "feature", "February", "federal", "fee", "feed", "feel", "fellow", "female",
        "fence", "festival", "fetch", "fever", "few", "fibre", "fiction", "field",
        "fierce", "fight", "figure", "file", "fill", "film", "final", "finance",
        "find", "fine", "finger", "fingernail", "finish", "fire", "fireworks",
        "firm", "fish", "fisherman", "fist", "fit", "fix", "flag", "flame", "flash",
        "flashlight", "flat", "flavour", "flee", "flesh", "flexible", "flight",
        "float", "flood", "floor", "flour", "flow", "flu", "fluent", "fly", "focus",
        "fog", "foggy", "fold", "folk", "follow", "fond", "food", "fool", "foolish",
        "foot", "football", "for", "forbid", "force", "forecast", "forehead",
        "foreign", "foreigner", "forest", "forever", "forget", "forgive", "fork",
        "form", "formal", "format", "former", "fortnight", "fortunate", "fortune",
        "forward", "found", "fountain", "fox", "fragile", "framework", "franc",
        "free", "freedom", "freeway", "freeze", "freezer", "frequent", "fresh",
        "friction", "fridge", "friend", "friendly", "friendship", "frighten",
        "frog", "from", "front", "frontier", "frost", "fruit", "fry", "fuel",
        "full", "fun", "function", "fundamental", "funeral", "funny", "fur",
        "furnished", "furniture", "future",
        # G 开头
        "gain", "gallery", "gallon", "game", "garage", "garbage", "garden", "garlic",
        "garment", "gas", "gate", "gather", "gay", "general", "generation",
        "generous", "gentle", "gentleman", "geography", "gesture", "get", "gift",
        "gifted", "giraffe", "girl", "give", "glad", "glance", "glare", "glass",
        "globe", "glory", "glove", "go", "goal", "goat", "god", "gold", "golden",
        "golf", "good", "goodbye", "goods", "goose", "govern", "government",
        "grade", "gradual", "graduate", "grain", "gram", "grammar", "grandchild",
        "granddaughter", "grandma", "grandpa", "grandparent", "grandson", "granny",
        "grape", "graph", "grasp", "grass", "grateful", "gravity", "great",
        "greedy", "green", "greengrocer", "greet", "grey", "grill", "grocer",
        "grocery", "ground", "group", "grow", "growth", "guarantee", "guard",
        "guess", "guest", "guidance", "guide", "guilty", "guitar", "gun", "guy",
        "gym", "gymnastics",
        # H 开头
        "habit", "hair", "haircut", "half", "hall", "ham", "hamburger", "hammer",
        "hand", "handbag", "handful", "handkerchief", "handle", "handsome", "handwriting",
        "hang", "happen", "happiness", "happy", "harbour", "hard", "hardly",
        "hardship", "harm", "harmful", "harmony", "harvest", "hat", "hatch",
        "hate", "have", "he", "head", "headache", "headline", "headmaster",
        "headmistress", "health", "healthy", "hear", "heart", "heat", "heaven",
        "heavy", "heel", "height", "helicopter", "hello", "help", "helpful",
        "hen", "her", "herb", "here", "hero", "hers", "herself", "hide", "high",
        "highway", "hill", "him", "himself", "hip", "hire", "his", " historian",
        "history", "hit", "hobby", "hold", "hole", "holiday", "hollow", "holy",
        "home", "homeland", "hometown", "homework", "honest", "honey", "honour",
        "hook", "hope", "hopeful", "hopeless", "horizon", "horn", "horrible",
        "horse", "hospital", "host", "hostess", "hot", "hotdog", "hotel", "hour",
        "house", "household", "housewife", "housework", "how", "however", "hug",
        "huge", "human", "humour", "hundred", "hunger", "hungry", "hunt", "hunter",
        "hurricane", "hurry", "hurt", "husband",
        # I 开头
        "I", "ice", "ice-cream", "idea", "identity", "identification", "idiom",
        "if", "ignore", "ill", "illegal", "illness", "illustrate", "image",
        "imagine", "immediately", "immigration", "import", "importance", "important",
        "impossible", "impress", "impression", "improve", "in", "inch", "incident",
        "include", "income", "increase", "indeed", "independence", "independent",
        "index", "indicate", "industry", "influence", "inform", "information",
        "initial", "injure", "injury", "ink", "inn", "innocent", "insect",
        "insert", "inside", "insist", "inspect", "inspire", "instant", "instead",
        "institute", "institution", "instruct", "instruction", "instrument",
        "insurance", "insure", "intelligence", "intend", "intention", "interest",
        "interesting", "international", "Internet", "interpreter", "interrupt",
        "interval", "interview", "into", "introduce", "introduction", "invade",
        "invent", "invention", "invitation", "invite", "iron", "island", "issue",
        "it", "item", "its", "itself",
        # J 开头
        "jacket", "jam", "jar", "jaw", "jazz", "jeans", "jeep", "jet", "jewel",
        "jewellery", "job", "jog", "join", "joke", "journal", "journalist",
        "journey", "joy", "judge", "judgement", "juice", "jump", "jungle",
        "junior", "junk", "just", "justice",
        # K 开头
        "kangaroo", "keep", "kettle", "key", "keyboard", "kick", "kid", "kill",
        "kilogram", "kilometre", "kind", "kindergarten", "kindness", "king",
        "kingdom", "kiss", "kitchen", "kite", "knee", "kneel", "knife", "knock",
        "know", "knowledge",
        # L 开头
        "lab", "labour", "lack", "ladder", "lady", "lake", "lamb", "lame", "lamp",
        "land", "language", "lantern", "lap", "large", "last", "late", "lately",
        "latest", "latter", "laugh", "law", "lawyer", "lay", "lazy", "lead",
        "leader", "leaf", "league", "leak", "learn", "least", "leave", "lecture",
        "left", "leg", "legal", "lemon", "lemonade", "lend", "length", "less",
        "lesson", "let", "letter", "level", "liberty", "librarian", "library",
        "license", "lid", "lie", "life", "lift", "light", "lightning", "like",
        "likely", "limit", "line", "link", "lion", "lip", "liquid", "list",
        "listen", "literature", "literary", "litre", "little", "live", "lively",
        "living", "load", "local", "location", "lock", "lonely", "long", "look",
        "loose", "loss", "lot", "loud", "lounge", "love", "lovely", "low", "luck",
        "lucky", "lunch",
        # M 开头
        "machine", "mad", "madam", "magazine", "magic", "maid", "mail", "main",
        "mainland", "maintain", "major", "majority", "make", "male", "man",
        "manage", "manager", "mankind", "manner", "many", "map", "maple", "marathon",
        "march", "mark", "market", "marriage", "married", "marry", "mask", "mass",
        "master", "mat", "match", "material", "mathematics", "maths", "matter",
        "mature", "maximum", "may", "maybe", "me", "meal", "mean", "meaning",
        "means", "meanwhile", "measure", "meat", "medal", "media", "medical",
        "medicine", "medium", "meet", "meeting", "melon", "member", "memorial",
        "memory", "mend", "mental", "mention", "menu", "merchant", "merciful",
        "mercy", "merely", "merry", "mess", "message", "messy", "metal", "method",
        "metre", "microphone", "microscope", "microwave", "middle", "midnight",
        "might", "mild", "mile", "milk", "millimetre", "million", "mind", "mine",
        "mineral", "minibus", "minimum", "minister", "ministry", "minority",
        "minus", "minute", "mirror", "miss", "missile", "mist", "mistake",
        "misunderstand", "mix", "mixture", "mobile", "model", "modem", "modern",
        "modest", "mom", "moment", "mommy", "money", "monitor", "monkey", "month",
        "monument", "mood", "moon", "mop", "moral", "more", "morning", "mosquito",
        "most", "mother", "motivation", "motor", "motorcycle", "motto", "mountain",
        "mourn", "mouse", "moustache", "mouth", "move", "movement", "movie",
        "Mr", "Mrs", "Ms", "much", "mud", "muddy", "multiply", "murder", "museum",
        "mushroom", "music", "musical", "musician", "must", "mustard", "mutual",
        "my", "myself",
        # N 开头
        "nail", "name", "narrow", "nation", "national", "native", "natural",
        "nature", "navy", "near", "nearby", "nearly", "neat", "necessary", "neck",
        "necklace", "need", "needle", "negative", "neglect", "negotiate",
        "neighbour", "neighbourhood", "neither", "nephew", "nervous", "nest",
        "net", "network", "never", "new", "news", "newspaper", "next", "nice",
        "niece", "night", "no", "noble", "nobody", "nod", "noise", "noisy",
        "none", "noodle", "noon", "nor", "normal", "north", "northeast",
        "northern", "northwest", "nose", "not", "note", "notebook", "nothing",
        "notice", "novel", "now", "nowadays", "nowhere", "nuclear", "numb",
        "number", "nurse", "nursery", "nut", "nutrition",
        # O 开头
        "obey", "object", "objective", "observation", "observe", "obtain", "obvious",
        "occupation", "occupy", "occur", "ocean", "o'clock", "October", "odd",
        "of", "off", "offence", "offer", "office", "officer", "official", "often",
        "oil", "OK", "old", "Olympic", "on", "once", "one", "oneself", "onion",
        "only", "onto", "open", "opera", "operate", "operation", "operator",
        "opinion", "oppose", "opposite", "optimistic", "optional", "or", "oral",
        "orange", "orbit", "order", "ordinary", "organ", "organic", "organism",
        "organization", "organize", "origin", "other", "otherwise", "ought",
        "our", "ours", "ourselves", "out", "outcome", "outdoor", "outer",
        "outing", "outstanding", "outward", "oval", "over", "overcoat", "overcome",
        "overhead", "overlook", "owe", "own", "owner", "ownership", "ox", "oxygen",
        # P 开头
        "pace", "Pacific", "pack", "package", "packet", "page", "pain", "painful",
        "paint", "painter", "painting", "pair", "palace", "pale", "pan", "pancake",
        "panda", "panic", "paper", "paragraph", "parcel", "pardon", "parent",
        "park", "parking", "parrot", "part", "participate", "particular",
        "partly", "partner", "part-time", "party", "pass", "passage", "passenger",
        "passer-by", "passive", "passport", "past", "patent", "path", "patience",
        "patient", "pattern", "pause", "pave", "paw", "pay", "PE", "peace",
        "peaceful", "peach", "pear", "peasant", "pedestrian", "pen", "pencil",
        "penny", "pension", "people", "pepper", "per", "percent", "percentage",
        "perfect", "perform", "performance", "performer", "perfume", "perhaps",
        "period", "permanent", "permission", "permit", "person", "personal",
        "personnel", "persuade", "pest", "pet", "petrol", "phenomenon", "phone",
        "photo", "photograph", "photographer", "phrase", "physical", "physician",
        "physicist", "physics", "pianist", "piano", "pick", "picnic", "picture",
        "pie", "piece", "pig", "pile", "pill", "pillow", "pilot", "pin", "pine",
        "pineapple", "ping-pong", "pink", "pint", "pioneer", "pipe", "pity",
        "place", "plain", "plan", "plane", "planet", "plant", "plastic", "plate",
        "platform", "play", "player", "playground", "pleasant", "please", "pleased",
        "pleasure", "plenty", "plot", "plug", "plus", "p.m.", "pocket", "poem",
        "poet", "point", "poison", "poisonous", "pole", "police", "policeman",
        "policy", "polish", "polite", "political", "politician", "politics",
        "pollute", "pollution", "pond", "pool", "poor", "pop", "popular",
        "population", "pork", "port", "portable", "porter", "position", "positive",
        "possess", "possession", "possibility", "possible", "post", "postage",
        "postcard", "postcode", "poster", "postman", "postpone", "pot", "potato",
        "potential", "pound", "pour", "powder", "power", "powerful", "practical",
        "practice", "practise", "praise", "pray", "precious", "precise", "predict",
        "prefer", "preference", "pregnant", "prejudice", "premier", "preparation",
        "prepare", "prescription", "present", "presentation", "preserve", "president",
        "press", "pressure", "pretend", "pretty", "prevent", "preview", "previous",
        "price", "pride", "primary", "primitive", "principle", "print", "printer",
        "prior", "prison", "prisoner", "private", "privilege", "prize", "probably",
        "problem", "procedure", "proceed", "process", "produce", "product",
        "production", "profession", "professional", "professor", "profit", "program",
        "programme", "progress", "prohibit", "project", "promise", "promote",
        "pronounce", "pronunciation", "proper", "property", "proposal", "propose",
        "prospect", "protect", "protection", "proud", "prove", "provide", "province",
        "psychology", "pub", "public", "publish", "pull", "pulse", "pump", "punctual",
        "punctuation", "punish", "punishment", "pupil", "purchase", "pure", "purpose",
        "purse", "push", "put", "puzzle",
        # Q 开头
        "quake", "qualification", "quality", "quantity", "quarrel", "quarter",
        "queen", "question", "questionnaire", "queue", "quick", "quiet", "quit",
        "quite", "quiz", "quotation", "quote",
        # R 开头
        "rabbit", "race", "racial", "radiation", "radio", "radioactive", "radium",
        "rail", "railway", "rain", "rainbow", "raincoat", "rainy", "raise", "random",
        "range", "rank", "rapid", "rare", "rat", "rate", "rather", "raw", "ray",
        "razor", "reach", "react", "reaction", "read", "reading", "ready", "real",
        "realise", "realize", "really", "reason", "reasonable", "rebuild", "receipt",
        "receive", "receiver", "recent", "reception", "receptionist", "recipe",
        "recite", "recognise", "recognize", "recommend", "record", "recorder",
        "recover", "recreation", "recycle", "red", "reduce", "refer", "reference",
        "reflect", "reform", "refresh", "refrigerator", "refuse", "regard", "regardless",
        "register", "regret", "regular", "regulation", "reject", "relate",
        "relation", "relationship", "relative", "relax", "relay", "relevant",
        "reliable", "relief", "religion", "religious", "rely", "remain", "remark",
        "remember", "remind", "remote", "remove", "rent", "repair", "repeat",
        "replace", "reply", "report", "reporter", "represent", "representative",
        "republic", "reputation", "request", "require", "requirement", "rescue",
        "research", "resemble", "reserve", "resign", "resist", "resource",
        "respect", "respond", "responsibility", "responsible", "rest", "restaurant",
        "restrict", "result", "retell", "retire", "return", "reunion", "reunite",
        "reveal", "review", "revision", "revolution", "reward", "rewind", "rhyme",
        "rice", "rich", "rid", "riddle", "ridiculous", "right", "rigid", "ring",
        "ripe", "rise", "risk", "river", "road", "roast", "rob", "robot", "rock",
        "rocket", "role", "roll", "roof", "room", "rooster", "root", "rope", "rose",
        "rot", "rough", "round", "route", "routine", "row", "royal", "rubber",
        "rubbish", "rude", "rugby", "ruin", "rule", "ruler", "run", "rush",
        # S 开头
        "sacred", "sacrifice", "sad", "safe", "safety", "sail", "sailing", "sailor",
        "salad", "salary", "sale", "salesman", "saleswoman", "salt", "salty",
        "salute", "same", "sample", "sand", "sandwich", "satellite", "satisfaction",
        "satisfy", "Saturday", "sauce", "sausage", "save", "say", "saying", "scare",
        "scarf", "scene", "scenery", "sceptical", "schedule", "scholar", "scholarship",
        "school", "schoolbag", "schoolboy", "schoolgirl", "schoolmate", "science",
        "scientific", "scientist", "scissors", "scold", "score", "scratch", "scream",
        "screen", "sculpture", "sea", "seagull", "seal", "search", "seashell",
        "seaside", "season", "seat", "second", "secret", "secretary", "section",
        "secure", "security", "see", "seed", "seek", "seem", "seize", "seldom",
        "select", "self", "selfish", "sell", "semester", "send", "senior", "sense",
        "sensitive", "sentence", "separate", "separation", "series", "serious",
        "servant", "serve", "service", "session", "set", "settle", "settlement",
        "settler", "several", "severe", "sew", "sex", "shabby", "shade", "shadow",
        "shake", "shall", "shallow", "shame", "shape", "share", "shark", "sharp",
        "sharpen", "shave", "she", "sheep", "sheet", "shelf", "shelter", "shine",
        "ship", "shirt", "shock", "shoe", "shoot", "shop", "shopkeeper", "shopping",
        "shore", "short", "shortcoming", "shortly", "shorts", "shot", "should",
        "shoulder", "shout", "show", "shower", "shrink", "shut", "shy", "sick",
        "sickness", "side", "sidewalk", "sigh", "sight", "sightseeing", "sign",
        "signal", "signature", "significance", "significant", "silence", "silent",
        "silk", "silly", "silver", "similar", "simple", "simplify", "since",
        "sincerely", "sing", "singer", "single", "sink", "sir", "sister", "sit",
        "situation", "size", "skate", "skateboard", "ski", "skill", "skilled",
        "skillful", "skin", "skip", "skirt", "sky", "slave", "slavery", "sleep",
        "sleepy", "sleeve", "slice", "slide", "slight", "slim", "slip", "slogan",
        "slow", "small", "smart", "smell", "smile", "smoke", "smooth", "snack",
        "snake", "sneaker", "sneeze", "snow", "snowy", "so", "soap", "sob", "soccer",
        "social", "socialism", "society", "sock", "socket", "sofa", "soft",
        "software", "soil", "solar", "soldier", "solid", "some", "somebody",
        "somehow", "someone", "something", "sometimes", "somewhere", "son", "song",
        "soon", "sore", "sorrow", "sorry", "sort", "soul", "sound", "soup", "sour",
        "south", "southeast", "southern", "southwest", "souvenir", "sow", "space",
        "spaceship", "spade", "spare", "sparrow", "speak", "speaker", "spear",
        "special", "specialist", "specific", "speech", "speed", "spell", "spelling",
        "spend", "spin", "spirit", "spiritual", "spit", "splendid", "split",
        "spoken", "spokesman", "spokeswoman", "sponsor", "spoon", "sport",
        "sportsman", "sportswoman", "spot", "spray", "spread", "spring", "spy",
        "square", "squeeze", "squirrel", "stable", "stadium", "staff", "stage",
        "stain", "stair", "stamp", "stand", "standard", "star", "stare", "start",
        "starvation", "starve", "state", "station", "statistic", "statue",
        "status", "stay", "steady", "steak", "steal", "steam", "steel", "steep",
        "step", "steward", "stewardess", "stick", "still", "stimulate", "sting",
        "stir", "stock", "stomach", "stomachache", "stone", "stop", "storage",
        "store", "storey", "storm", "story", "stove", "straight", "strait",
        "strange", "stranger", "straw", "strawberry", "stream", "street",
        "strength", "strengthen", "stress", "strict", "strike", "string",
        "strip", "stripe", "stroke", "strong", "struggle", "stubborn", "student",
        "studio", "study", "stuff", "stupid", "style", "subject", "subjective",
        "submit", "subscribe", "substitute", "succeed", "success", "successful",
        "such", "suck", "sudden", "suffer", "suffering", "sugar", "suggest",
        "suggestion", "suit", "suitable", "suitcase", "suite", "summary",
        "summer", "sun", "sunburn", "Sunday", "sunglasses", "sunny", "sunrise",
        "sunset", "sunshine", "super", "superb", "superior", "supermarket",
        "supper", "supply", "support", "suppose", "supreme", "sure", "surface",
        "surgeon", "surplus", "surprise", "surround", "surrounding", "survival",
        "survive", "survivor", "suspect", "suspend", "swallow", "swear", "sweat",
        "sweater", "sweep", "sweet", "swell", "swift", "swim", "swing", "switch",
        "sword", "symbol", "sympathy", "symptom", "system", "systematic",
        # T 开头
        "table", "tablet", "tail", "tailor", "take", "tale", "talent", "talk",
        "tall", "tank", "tap", "tape", "target", "task", "taste", "tasteless",
        "tasty", "tax", "taxi", "tea", "teach", "teacher", "team", "teapot",
        "tear", "tease", "technical", "technique", "technology", "teenage",
        "teenager", "telegram", "telephone", "telescope", "television", "tell",
        "temperature", "temple", "tempo", "temporary", "tend", "tendency",
        "tennis", "tense", "tension", "tent", "term", "terminal", "terrible",
        "terrify", "terror", "test", "text", "textbook", "than", "thank",
        "thankful", "that", "the", "theatre", "their", "theirs", "them",
        "theme", "themselves", "then", "theoretical", "theory", "there",
        "therefore", "thermos", "these", "they", "thick", "thief", "thin",
        "thing", "think", "thinking", "thirst", "thirsty", "this", "thorough",
        "those", "though", "thought", "thread", "thrill", "thrilled", "throat",
        "through", "throughout", "throw", "thunder", "thunderstorm", "thus",
        "tick", "ticket", "tidy", "tie", "tiger", "tight", "time", "timetable",
        "tin", "tiny", "tip", "tire", "tired", "tiresome", "tissue", "title",
        "to", "toast", "tobacco", "today", "together", "toilet", "tolerate",
        "tomato", "tomorrow", "ton", "tone", "tongue", "tonight", "too", "tool",
        "tooth", "toothache", "top", "topic", "total", "touch", "tough", "tour",
        "tourist", "tournament", "toward", "towards", "towel", "tower", "town",
        "toy", "track", "tractor", "trade", "tradition", "traditional", "traffic",
        "train", "training", "tram", "transform", "translate", "translation",
        "translator", "transparent", "transport", "trap", "travel", "traveller",
        "treasure", "treat", "treatment", "tree", "tremble", "trend", "trial",
        "triangle", "trick", "trip", "trolley", "troop", "trouble", "trousers",
        "truck", "true", "truly", "trunk", "trust", "truth", "try", "T-shirt",
        "tube", "tune", "turkey", "turn", "turning", "tutor", "twice", "twin",
        "type", "typical", "typist", "tyre",
        # U 开头
        "ugly", "umbrella", "unable", "unbearable", "unbelievable", "uncertain",
        "uncle", "uncomfortable", "unconditional", "unconscious", "under",
        "underground", "underline", "understand", "understanding", "undertake",
        "underwear", "unemployment", "unfair", "unfit", "unfold", "unfortunate",
        "unfortunately", "unhappy", "unhealthy", "uniform", "union", "unique",
        "unit", "unite", "united", "universe", "university", "unless", "unlike",
        "unrest", "until", "unusual", "unwilling", "up", "update", "upon",
        "upper", "upset", "upstairs", "upward", "urban", "urge", "urgent", "us",
        "use", "used", "useful", "useless", "user", "usual", "usually", "utility",
        # V 开头
        "vacation", "vacant", "vague", "vain", "valid", "valley", "valuable",
        "value", "van", "vanish", "variety", "various", "vase", "vast", "vegetable",
        "vegetarian", "vehicle", "version", "vertical", "very", "vest", "via",
        "victim", "victory", "video", "view", "village", "villager", "vinegar",
        "violate", "violence", "violent", "violin", "virtue", "virus", "visa",
        "visit", "visitor", "visual", "vital", "vivid", "vocabulary", "voice",
        "volcano", "volleyball", "volunteer", "vote", "voyage",
        # W 开头
        "wage", "waist", "wait", "waiter", "waiting-room", "waitress", "wake",
        "walk", "wall", "wallet", "walnut", "wander", "want", "war", "ward",
        "warehouse", "warm", "warmth", "warn", "wash", "washroom", "waste",
        "watch", "water", "watermelon", "wave", "wax", "way", "we", "weak",
        "weakness", "wealth", "wealthy", "wear", "weather", "web", "website",
        "wedding", "weed", "week", "weekday", "weekend", "weekly", "weep",
        "weigh", "weight", "welcome", "welfare", "well", "west", "western",
        "westward", "wet", "whale", "what", "whatever", "wheat", "wheel",
        "when", "whenever", "where", "wherever", "whether", "which", "whichever",
        "while", "whisper", "whistle", "white", "who", "whoever", "whole",
        "whom", "whose", "why", "wide", "widespread", "widow", "width", "wife",
        "wild", "wildlife", "will", "willing", "win", "wind", "window", "wine",
        "wing", "winner", "winter", "wipe", "wire", "wisdom", "wise", "wish",
        "with", "withdraw", "within", "without", "witness", "wolf", "woman",
        "wonder", "wonderful", "wood", "wooden", "wool", "word", "work",
        "worker", "workforce", "workplace", "works", "world", "worldwide",
        "worm", "worried", "worry", "worth", "worthwhile", "worthy", "would",
        "wound", "wrap", "wrinkle", "wrist", "write", "writer", "writing",
        "written", "wrong",
        # X, Y, Z 开头
        "X-ray", "yard", "yawn", "year", "yell", "yellow", "yes", "yesterday",
        "yet", "yoghurt", "you", "young", "your", "yours", "yourself", "youth",
        "zero", "zip", "zipper", "zone", "zoo", "zoom",
    }

    # 常见短语搭配（从高考真题中高频出现的）
    COMMON_PHRASES = [
        # 动词短语
        "take up", "take on", "take off", "take over", "take in", "take away",
        "take care of", "take place", "take part in", "take advantage of",
        "put up", "put on", "put off", "put away", "put forward", "put out",
        "put up with", "put down",
        "get up", "get on", "get off", "get over", "get through", "get along",
        "get away", "get rid of", "get used to",
        "turn up", "turn down", "turn on", "turn off", "turn out", "turn over",
        "turn around", "turn to",
        "come up", "come up with", "come across", "come out", "come on",
        "come back", "come true", "come into",
        "go on", "go over", "go through", "go out", "go back", "go ahead",
        "go away", "go by",
        "set up", "set out", "set off", "set down", "set aside",
        "pick up", "pick out",
        "bring up", "bring about", "bring in", "bring out", "bring back",
        "call on", "call up", "call off", "call for", "call back",
        "look up", "look for", "look after", "look into", "look forward to",
        "look out", "look through", "look down on",
        "make up", "make out", "make up for", "make sense", "make sure",
        "make out of", "make way for",
        "give up", "give in", "give away", "give back", "give off", "give out",
        "break down", "break out", "break up", "break in", "break through",
        "hold on", "hold up", "hold back", "hold out",
        "pay attention to", "pay back", "pay off", "pay for",
        "run out", "run out of", "run over", "run away", "run into",
        "work out", "work on", "work at", "work up",
        "speak up", "speak out",
        "stand up", "stand for", "stand out", "stand by",
        "carry on", "carry out", "carry away",
        "figure out", "find out", "fill in", "fill out",
        "hand in", "hand out", "hand over",
        "leave out", "leave behind", "leave for",
        "point out", "pull out", "push forward",
        # 介词短语
        "in addition", "in addition to", "in fact", "in general", "in particular",
        "in order to", "in order that", "in case", "in case of", "in charge of",
        "in common", "in comparison with", "in conclusion", "in confidence",
        "in connection with", "in consequence", "in contrast", "in danger",
        "in debt", "in detail", "in difficulty", "in effect", "in front of",
        "in favor of", "in future", "in hand", "in honor of", "in need of",
        "in other words", "in person", "in place of", "in practice",
        "in public", "in return", "in short", "in sight", "in spite of",
        "in terms of", "in time", "in turn", "in use", "in vain", "in view of",
        "on average", "on behalf of", "on board", "on business", "on duty",
        "on fire", "on foot", "on guard", "on holiday", "on occasion",
        "on purpose", "on sale", "on schedule", "on second thoughts",
        "on the contrary", "on the one hand", "on the other hand",
        "out of breath", "out of control", "out of date", "out of order",
        "out of question", "out of reach", "out of work", "out of sight",
        "at all", "at first", "at last", "at least", "at most", "at once",
        "at present", "at random", "at risk", "at the same time",
        "for example", "for instance", "for sure", "for the moment",
        "as a matter of fact", "as a result", "as far as", "as if", "as long as",
        "as soon as", "as though", "as well", "as well as",
        "by accident", "by chance", "by hand", "by heart", "by means of",
        "by mistake", "by the way",
        "with regard to", "with respect to", "with the help of",
        # 形容词+介词
        "afraid of", "angry with", "anxious about", "aware of", "bad for",
        "based on", "bored with", "busy with", "capable of", "careful of",
        "concerned about", "connected with", "crazy about", "curious about",
        "different from", "disappointed with", "due to", "eager for",
        "engaged in", "enthusiastic about", "equal to", "excellent at",
        "excited about", "familiar with", "famous for", "fed up with",
        "fond of", "friendly to", "full of", "good at", "grateful for",
        "guilty of", "happy with", "interested in", "keen on", "kind to",
        "liable for", "lonely without", "lucky at", "nervous about",
        "open to", "opposite to", "pessimistic about", "pleased with",
        "popular with", "proud of", "ready for", "related to", "responsible for",
        "satisfied with", "serious about", "short of", "similar to", "sorry for",
        "suitable for", "superior to", "sure of", "surprised at", "suspicious of",
        "thankful for", "tired of", "typical of", "upset about", "used to",
        "worried about", "wrong with", "worthy of",
        # 其他高考常见搭配
        "according to", "because of", "instead of", "prior to", "thanks to",
        "owing to", "regardless of", "apart from", "aside from", "next to",
        "up to", "close to", "due to", "next to", "prior to", "subsequent to",
    ]

    def __init__(self, articles_dir: str = "../../data/gaokao-articles"):
        self.articles_dir = articles_dir
        self.articles: List[Article] = []
        self.word_counter = Counter()
        self.phrase_counter = Counter()
        self.word_contexts = defaultdict(list)  # word -> [sentences]

    def load_articles(self) -> int:
        """加载所有文章数据"""
        path = Path(self.articles_dir)
        if not path.exists():
            print(f"Directory not found: {self.articles_dir}")
            return 0

        count = 0
        for json_file in path.glob("*.json"):
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    article = Article(
                        id=item.get('id', ''),
                        title=item.get('title', ''),
                        content=item.get('content', ''),
                        source=item.get('source', ''),
                        source_url=item.get('source_url', ''),
                        year=item.get('year'),
                        exam_type=item.get('exam_type'),
                        article_type=item.get('article_type'),
                        tags=item.get('tags', []),
                        fetched_at=item.get('fetched_at', ''),
                    )
                    self.articles.append(article)
                    count += 1
        print(f"Loaded {count} articles from {len(list(path.glob('*.json')))} files")
        return count

    # 停用词集合（用于快速查找）
    STOP_WORDS_SET = None  # 延迟初始化

    def _get_stop_words(self) -> set:
        if self.STOP_WORDS_SET is None:
            # 从 tokenize 方法中提取的停用词列表
            self.STOP_WORDS_SET = {
                'a', 'an', 'the', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
                'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'shall',
                'would', 'should', 'may', 'might', 'can', 'could', 'must', 'ought',
                'need', 'dare', 'used', 'i', 'me', 'my', 'myself', 'we', 'our',
                'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
                'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it',
                'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
                'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
                'whose', 'whatever', 'whichever', 'whoever', 'one', 'ones', 'someone',
                'anyone', 'everyone', 'nobody', 'somebody', 'anybody', 'everybody',
                'something', 'anything', 'everything', 'nothing', 'each', 'every',
                'both', 'either', 'neither', 'all', 'none', 'another', 'other',
                'others', 'such', 'so', 'in', 'on', 'at', 'by', 'to', 'of', 'for',
                'with', 'about', 'against', 'between', 'into', 'through', 'during',
                'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
                'over', 'under', 'again', 'further', 'then', 'once', 'from', 'and',
                'but', 'or', 'yet', 'nor', 'not', 'no', 'as', 'while', 'if', 'than',
                'then', 'so', 'thus', 'here', 'there', 'when', 'where', 'why', 'how',
                'now', 'too', 'also', 'only', 'just', 'very', 'really', 'still',
                'already', 'always', 'never', 'often', 'sometimes', 'usually',
                'quite', 'rather', 'pretty', 'fairly', 'many', 'much', 'more', 'most',
                'some', 'any', 'several', 'various', 'new', 'old', 'good', 'bad',
                'big', 'small', 'high', 'low', 'long', 'short', 'great', 'little',
                'large', 'different', 'same', 'right', 'left', 'next', 'last',
                'early', 'late', 'recent', 'current', 'modern', 'main', 'major',
                'key', 'important', 'necessary', 'possible', 'certain', 'particular',
                'specific', 'general', 'common', 'popular', 'famous', 'well',
                'better', 'best', 'able', 'unable', 'ready', 'public', 'private',
                'local', 'national', 'international', 'global', 'social', 'political',
                'economic', 'cultural', 'physical', 'mental', 'human', 'personal',
                'professional', 'academic', 'scientific', 'people', 'person', 'man',
                'woman', 'child', 'children', 'family', 'group', 'team', 'class',
                'school', 'student', 'teacher', 'year', 'day', 'time', 'way', 'part',
                'place', 'area', 'region', 'world', 'country', 'city', 'town',
                'community', 'society', 'life', 'work', 'job', 'career', 'business',
                'company', 'organization', 'system', 'program', 'project', 'activity',
                'event', 'process', 'period', 'level', 'rate', 'number', 'amount',
                'kind', 'type', 'sort', 'form', 'example', 'case', 'point', 'fact',
                'idea', 'problem', 'question', 'issue', 'result', 'effect', 'change',
                'development', 'growth', 'increase', 'decrease', 'improvement',
                'difference', 'similarity', 'information', 'data', 'knowledge',
                'understanding', 'experience', 'skill', 'ability', 'quality',
                'feature', 'characteristic', 'research', 'study', 'survey', 'report',
                'article', 'paper', 'book', 'text', 'story', 'news', 'message',
                'note', 'letter', 'word', 'make', 'get', 'take', 'come', 'go', 'see',
                'know', 'think', 'say', 'tell', 'ask', 'give', 'put', 'keep', 'let',
                'help', 'show', 'play', 'run', 'move', 'live', 'believe', 'bring',
                'begin', 'start', 'stop', 'end', 'finish', 'continue', 'remain',
                'become', 'seem', 'appear', 'feel', 'look', 'sound', 'try', 'want',
                'need', 'like', 'love', 'prefer', 'enjoy', 'hope', 'wish', 'expect',
                'agree', 'disagree', 'accept', 'refuse', 'allow', 'permit',
                'require', 'suggest', 'recommend', 'decide', 'choose', 'select',
                'pick', 'find', 'lose', 'win', 'fail', 'succeed', 'achieve',
                'accomplish', 'complete', 'perform', 'conduct', 'carry', 'hold',
                'support', 'maintain', 'prevent', 'avoid', 'protect', 'save', 'add',
                'reduce', 'remove', 'build', 'create', 'produce', 'generate',
                'develop', 'grow', 'establish', 'set', 'place', 'leave', 'return',
                'reach', 'arrive', 'enter', 'join', 'attend', 'participate', 'visit',
                'travel', 'send', 'receive', 'buy', 'sell', 'pay', 'spend', 'cost',
                'value', 'share', 'collect', 'gather', 'combine', 'connect', 'relate',
                'compare', 'contrast', 'match', 'fit', 'suit', 'meet', 'face',
                'cover', 'deal', 'handle', 'address', 'manage', 'control', 'check',
                'test', 'measure', 'weigh', 'count', 'calculate', 'estimate', 'plan',
                'design', 'prepare', 'organize', 'arrange', 'schedule', 'cause',
                'lead', 'use', 'provide', 'offer', 'include', 'serve', 'serve',
                'serve', 'call', 'act', 'play', 'open', 'close', 'run', 'serve',
                'clear', 'free', 'full', 'open', 'close', 'hard', 'light', 'fast',
                'past', 'present', 'future', 'first', 'second', 'third', 'last',
                'next', 'other', 'another', 'same', 'different', 'such', 'own',
                'own', 'several', 'certain', 'various', 'many', 'few', 'little',
                'much', 'more', 'most', 'some', 'any', 'no', 'every', 'each',
                'all', 'both', 'either', 'neither', 'none', 'one', 'two', 'three',
                'way', 'thing', 'part', 'place', 'number', 'kind', 'sort', 'type',
                'form', 'case', 'point', 'fact', 'idea', 'problem', 'question',
                'issue', 'example', 'instance', 'reason', 'cause', 'result',
                'effect', 'change', 'increase', 'decrease', 'difference',
                'development', 'growth', 'improvement', 'information', 'knowledge',
                'understanding', 'experience', 'skill', 'ability', 'quality',
                'feature', 'characteristic', 'research', 'study', 'survey',
                'report', 'article', 'paper', 'book', 'text', 'story', 'news',
                'message', 'note', 'letter', 'word', 'line', 'page', 'chapter',
                'section', 'paragraph', 'sentence', 'phrase', 'term', 'name',
                'title', 'subject', 'topic', 'theme', 'issue', 'matter',
                'affair', 'business', 'concern', 'interest', 'importance',
                'significance', 'meaning', 'sense', 'purpose', 'aim', 'goal',
                'objective', 'target', 'intention', 'plan', 'design', 'scheme',
                'plot', 'project', 'task', 'job', 'work', 'duty',
                'responsibility', 'obligation', 'commitment', 'promise',
                'pledge', 'guarantee', 'assurance', 'security', 'safety',
                'protection', 'defense', 'shelter', 'place', 'location',
                'position', 'site', 'spot', 'point', 'station', 'base', 'center',
                'core', 'heart', 'middle', 'area', 'region', 'zone', 'sector',
                'district', 'neighborhood', 'environment', 'setting', 'context',
                'background', 'scene', 'view', 'landscape', 'appearance',
                'feature', 'nature', 'character', 'attitude', 'opinion',
                'belief', 'trust', 'confidence', 'hope', 'future', 'chance',
                'opportunity', 'example', 'sample', 'model', 'standard',
                'criterion', 'principle', 'rule', 'law', 'theory', 'teaching',
                'lesson', 'meaning', 'importance', 'value', 'worth', 'merit',
                'advantage', 'benefit', 'gain', 'profit', 'interest',
                'reward', 'prize', 'honor', 'credit', 'recognition',
                'praise', 'admiration', 'respect', 'attention', 'notice',
                'awareness', 'feeling', 'emotion', 'love', 'taste',
                'preference', 'tendency', 'trend', 'direction', 'action',
                'activity', 'operation', 'function', 'performance',
                'application', 'use', 'practice', 'training', 'preparation',
                'fitness', 'qualification', 'suitability', 'enough',
                'abundance', 'wealth', 'property', 'possession', 'asset',
                'resource', 'material', 'matter', 'substance', 'equipment',
                'tool', 'device', 'machine', 'mechanism', 'engine', 'motor',
                'battery', 'fuel', 'gas', 'oil', 'coal', 'wood', 'stone',
                'rock', 'sand', 'soil', 'earth', 'ground', 'land', 'field',
                'forest', 'tree', 'plant', 'flower', 'grass', 'cell',
                'organ', 'system', 'body', 'head', 'brain', 'mind', 'face',
                'eye', 'ear', 'nose', 'mouth', 'hand', 'finger', 'arm',
                'leg', 'foot', 'heart', 'blood', 'skin', 'hair', 'figure',
                'shape', 'form', 'structure', 'posture', 'movement',
                'motion', 'action', 'deed', 'act', 'success', 'victory',
                'win', 'gain', 'profit', 'advantage', 'benefit', 'gift',
                'present', 'donation', 'tax', 'duty', 'charge', 'fee',
                'cost', 'price', 'rate', 'value', 'worth', 'amount', 'sum',
                'total', 'quantity', 'number', 'count', 'score', 'mark',
                'grade', 'degree', 'level', 'standard', 'quality', 'class',
                'rank', 'status', 'standing', 'position', 'place', 'role',
                'part', 'function', 'job', 'task', 'mission', 'operation',
                'campaign', 'drive', 'movement', 'effort', 'attempt',
                'try', 'go', 'turn', 'chance', 'opening', 'position',
                'post', 'appointment', 'nomination', 'election',
                'selection', 'choice', 'pick', 'option', 'alternative',
                'favorite', 'model', 'example', 'ideal', 'standard',
                'principle', 'order', 'command', 'instruction',
                'guidance', 'advice', 'counsel', 'recommendation',
                'suggestion', 'proposal', 'motion', 'resolution',
                'decision', 'determination', 'resolve', 'will',
                'intention', 'purpose', 'aim', 'goal', 'objective',
                'target', 'end', 'destination', 'finish', 'conclusion',
                'close', 'closure', 'completion', 'fulfillment',
                'realization', 'achievement', 'accomplishment',
                'attainment', 'acquisition', 'gain', 'earning',
                'winning', 'securing', 'acquiring', 'getting',
                'obtaining', 'receiving', 'accepting', 'taking',
                'adopting', 'embracing', 'welcoming', 'greeting',
                'saluting', 'hailing', 'addressing', 'speaking',
                'talking', 'conversing', 'chatting', 'discussing',
                'debating', 'arguing', 'disputing', 'fighting',
                'struggling', 'striving', 'endeavoring', 'trying',
                'attempting', 'seeking', 'pursuing', 'chasing',
                'hunting', 'searching', 'looking', 'inquiring',
                'asking', 'requesting', 'demanding', 'requiring',
                'needing', 'wanting', 'desiring', 'wishing', 'hoping',
                'expecting', 'anticipating', 'awaiting', 'waiting',
                'staying', 'remaining', 'lingering', 'delaying',
                'postponing', 'deferring', 'suspending', 'pausing',
                'stopping', 'halting', 'ceasing', 'ending',
                'terminating', 'finishing', 'completing', 'concluding',
                'closing', 'shutting', 'sealing', 'locking', 'barring',
                'blocking', 'obstructing', 'hindering', 'impeding',
                'preventing', 'averting', 'avoiding', 'shunning',
                'eschewing', 'forgoing', 'abstaining', 'refraining',
                'desisting', 'ceasing', 'stopping', 'quitting',
                'leaving', 'departing', 'exiting', 'going', 'coming',
                'returning', 'reverting', 'recurring', 'repeating',
                'reiterating', 'restating', 'rephrasing', 'rewording',
                'revising', 'editing', 'correcting', 'amending',
                'rectifying', 'remedying', 'repairing', 'mending',
                'fixing', 'patching', 'restoring', 'renovating',
                'renewing', 'refurbishing', 'overhauling', 'rebuilding',
                'reconstructing', 'rehabilitating', 'recovering',
                'healing', 'curing', 'treating', 'nursing', 'caring',
                'tending', 'attending', 'serving', 'helping', 'aiding',
                'assisting', 'promoting', 'furthering', 'advancing',
                'progressing', 'developing', 'evolving', 'growing',
                'maturing', 'ripening', 'aging', 'declining',
                'deteriorating', 'degenerating', 'decaying', 'rotting',
                'spoiling', 'tainting', 'contaminating', 'polluting',
                'infecting', 'affecting', 'influencing', 'impacting',
                'touching', 'moving', 'stirring', 'shaking', 'rocking',
                'shocking', 'startling', 'surprising', 'astonishing',
                'amazing', 'astounding', 'stunning', 'overwhelming',
                'conquering', 'defeating', 'overcoming', 'suppressing',
                'repressing', 'oppressing', 'pressing', 'squeezing',
                'crushing', 'squashing', 'flattening', 'smoothing',
                'leveling', 'grading', 'rating', 'ranking',
                'classifying', 'categorizing', 'grouping', 'sorting',
                'organizing', 'arranging', 'ordering', 'standardizing',
                'normalizing', 'regularizing', 'routinizing',
                'habituating', 'accustoming', 'familiarizing',
                'acquainting', 'introducing', 'presenting', 'showing',
                'demonstrating', 'exhibiting', 'displaying', 'revealing',
                'disclosing', 'exposing', 'uncovering', 'unveiling',
                'opening', 'unlocking', 'unfastening', 'loosening',
                'relaxing', 'easing', 'softening', 'smoothing',
                'polishing', 'refining', 'purifying', 'cleaning',
                'clearing', 'clarifying', 'washing', 'bathing',
                'showering', 'rinsing', 'soaking', 'steeping',
                'immersing', 'submerging', 'dipping', 'plunging',
                'diving', 'jumping', 'leaping', 'springing',
                'bounding', 'hopping', 'skipping', 'dancing',
                'prancing', 'strutting', 'strolling', 'sauntering',
                'wandering', 'roaming', 'rambling', 'meandering',
                'roving', 'ranging', 'traversing', 'crossing',
                'spanning', 'bridging', 'linking', 'connecting',
                'joining', 'uniting', 'combining', 'merging', 'fusing',
                'blending', 'mixing', 'mingling', 'integrating',
                'incorporating', 'embodying', 'containing', 'including',
                'comprising', 'consisting', 'involving', 'entailing',
                'implying', 'suggesting', 'hinting', 'indicating',
                'signifying', 'meaning', 'denoting', 'connoting',
                'representing', 'symbolizing', 'standing', 'amounting',
                'equaling', 'matching', 'corresponding', 'paralleling',
                'resembling', 'simulating', 'imitating', 'copying',
                'duplicating', 'reproducing', 'replicating', 'recurring',
                'returning', 'reverting', 'relapsing', 'retrogressing',
                'regressing', 'degenerating', 'deteriorating',
                'worsening', 'aggravating', 'exacerbating',
                'intensifying', 'heightening', 'deepening',
                'strengthening', 'fortifying', 'reinforcing',
                'consolidating', 'solidifying', 'hardening',
                'toughening', 'stiffening', 'tightening', 'tensing',
                'straining', 'stretching', 'extending', 'lengthening',
                'prolonging', 'protracting', 'delaying', 'suspending',
                'halting', 'stopping', 'ceasing', 'ending',
                'terminating', 'concluding', 'finishing', 'completing',
                'accomplishing', 'achieving', 'attaining', 'realizing',
                'fulfilling', 'satisfying', 'meeting', 'filling',
                'occupying', 'engaging', 'employing', 'using',
                'utilizing', 'exploiting', 'harnessing', 'tapping',
                'mining', 'extracting', 'deriving', 'getting',
                'acquiring', 'gaining', 'winning', 'earning',
                'deserving', 'meriting', 'warranting', 'justifying',
                'explaining', 'accounting', 'excusing', 'pardoning',
                'forgiving', 'absolving', 'acquitting', 'exonerating',
                'vindicating', 'clearing', 'liberating', 'freeing',
                'releasing', 'delivering', 'rescuing', 'saving',
                'salvaging', 'recovering', 'retrieving', 'reclaiming',
                'redeeming', 'buying', 'purchasing', 'paying',
                'spending', 'expending', 'disbursing', 'dispensing',
                'distributing', 'allocating', 'allotting', 'assigning',
                'appointing', 'naming', 'nominating', 'designating',
                'identifying', 'specifying', 'defining', 'determining',
                'deciding', 'settling', 'resolving', 'solving',
                'answering', 'replying', 'responding', 'reacting',
                'acting', 'behaving', 'conducting', 'carrying',
                'bearing', 'holding', 'possessing', 'owning', 'having',
                "'s", "n't", "'re", "'ve", "'ll", "'d", "'m", "'",
            }
        return self.STOP_WORDS_SET

    def _is_stop_word(self, w: str) -> bool:
        """检查是否为停用词（支持复数形式）"""
        stops = self._get_stop_words()
        if w in stops:
            return True
        # 检查复数形式（简单规则：去掉 s/es）
        if w.endswith('ies') and w[:-3] + 'y' in stops:
            return True
        if w.endswith('es') and w[:-2] in stops:
            return True
        if w.endswith('s') and w[:-1] in stops:
            return True
        return False

    def tokenize(self, text: str) -> List[str]:
        """简单的英文分词（保留词干，转小写）"""
        # 移除标点
        text = text.lower()
        for p in string.punctuation:
            text = text.replace(p, ' ')
        # 分词并过滤
        words = []
        for w in text.split():
            w = w.strip()
            # 过滤纯数字和太短/太长的词
            if w.isdigit() or len(w) < 3 or len(w) > 20:
                continue
            # 过滤常见停用词（保留 although, however, therefore 等高考重点词）
            if self._is_stop_word(w):
                continue
            words.append(w)
        return words

    def extract_sentences(self, text: str) -> List[str]:
        """提取句子"""
        # 简单按句号/问号/感叹号分割
        sentences = re.split(r'[.!?]+', text)
        return [s.strip() for s in sentences if len(s.strip()) > 20]

    def find_phrases(self, text: str) -> List[str]:
        """在文本中查找常见短语"""
        text_lower = text.lower()
        found = []
        for phrase in self.COMMON_PHRASES:
            count = text_lower.count(phrase)
            if count > 0:
                found.extend([phrase] * count)
        return found

    def analyze(self):
        """执行完整分析"""
        if not self.articles:
            self.load_articles()

        print(f"\nAnalyzing {len(self.articles)} articles...")

        all_text = ""
        for article in self.articles:
            all_text += article.content + " "

        # 1. 词频统计
        words = self.tokenize(all_text)
        self.word_counter = Counter(words)

        # 2. 短语统计
        phrases = self.find_phrases(all_text)
        self.phrase_counter = Counter(phrases)

        # 3. 提取每个词的上下文例句
        sentences = self.extract_sentences(all_text)
        for sent in sentences:
            sent_words = self.tokenize(sent)
            for w in set(sent_words):
                if len(self.word_contexts[w]) < 5:  # 最多存5个例句
                    self.word_contexts[w].append(sent)

        print(f"Total words: {len(words)}")
        print(f"Unique words: {len(self.word_counter)}")
        print(f"Phrases found: {len(phrases)}")

    def get_word_meaning(self, word: str) -> List[str]:
        """获取单词含义（简单推断，实际可接词典API）"""
        # 这里用简单的映射表，实际可扩展为调用词典API
        # 对于高中核心词汇，返回常见含义
        meanings = {
            "ability": ["n. 能力，才能"],
            "achieve": ["v. 达到，实现，完成"],
            "advantage": ["n. 优势，有利条件"],
            "affect": ["v. 影响，感动"],
            "approach": ["n. 方法，途径; v. 接近，着手处理"],
            "assume": ["v. 假设，认为，承担"],
            "attempt": ["n./v. 尝试，企图"],
            "attitude": ["n. 态度，看法"],
            "attract": ["v. 吸引，引起兴趣"],
            "benefit": ["n. 益处，好处; v. 有益于"],
            "challenge": ["n./v. 挑战"],
            "circumstance": ["n. 环境，情况，境遇"],
            "claim": ["v. 声称，要求; n. 声明，要求"],
            "combine": ["v. 结合，联合"],
            "communicate": ["v. 交流，沟通，传达"],
            "compare": ["v. 比较，对照"],
            "concentrate": ["v. 集中，专心"],
            "concern": ["n./v. 关心，担心，涉及"],
            "conclusion": ["n. 结论，结局"],
            "conduct": ["v. 进行，实施，指挥; n. 行为"],
            "consequence": ["n. 结果，后果"],
            "consider": ["v. 考虑，认为"],
            "consist": ["v. 由...组成，在于"],
            "constant": ["adj. 不断的，持续的; n. 常数"],
            "construct": ["v. 建造，构造"],
            "consume": ["v. 消费，消耗"],
            "contact": ["n./v. 联系，接触"],
            "contain": ["v. 包含，容纳"],
            "contribute": ["v. 贡献，投稿，促成"],
            "control": ["n./v. 控制，支配"],
            "convenient": ["adj. 方便的，便利的"],
            "convince": ["v. 说服，使确信"],
            "create": ["v. 创造，创建"],
            "culture": ["n. 文化，文明，培养"],
            "current": ["adj. 当前的，现行的; n. 水流，电流"],
            "declare": ["v. 宣布，声明"],
            "decline": ["n./v. 下降，衰退，拒绝"],
            "decrease": ["n./v. 减少，减小"],
            "demand": ["n./v. 要求，需求"],
            "demonstrate": ["v. 证明，演示，示威"],
            "deny": ["v. 否认，拒绝"],
            "depend": ["v. 依靠，取决于"],
            "describe": ["v. 描述，形容"],
            "design": ["n./v. 设计，图案"],
            "determine": ["v. 决定，确定，查明"],
            "develop": ["v. 发展，开发，养成"],
            "devote": ["v. 致力于，奉献"],
            "difference": ["n. 差异，不同"],
            "difficult": ["adj. 困难的"],
            "direct": ["adj. 直接的; v. 指导，导演"],
            "disappear": ["v. 消失"],
            "discover": ["v. 发现"],
            "discuss": ["v. 讨论"],
            "distinguish": ["v. 区分，辨别"],
            "distribute": ["v. 分配，分布"],
            "economy": ["n. 经济，节约"],
            "effect": ["n. 影响，效果; v. 实现"],
            "effort": ["n. 努力"],
            "emphasis": ["n. 强调，重点"],
            "emphasize": ["v. 强调"],
            "enable": ["v. 使能够"],
            "encourage": ["v. 鼓励"],
            "energy": ["n. 能量，精力"],
            "engage": ["v. 从事，参与，吸引"],
            "enhance": ["v. 提高，增强"],
            "ensure": ["v. 确保，保证"],
            "environment": ["n. 环境"],
            "equal": ["adj. 相等的; n. 对手; v. 等于"],
            "equip": ["v. 装备，配备"],
            "escape": ["n./v. 逃跑，逃避"],
            "especially": ["adv. 尤其，特别"],
            "essential": ["adj. 必要的，本质的"],
            "establish": ["v. 建立，确立"],
            "estimate": ["n./v. 估计，估价"],
            "evaluate": ["v. 评价，评估"],
            "event": ["n. 事件，大事"],
            "evidence": ["n. 证据"],
            "evident": ["adj. 明显的"],
            "evolution": ["n. 进化，演变"],
            "examine": ["v. 检查，考试"],
            "example": ["n. 例子，榜样"],
            "exchange": ["n./v. 交换，交流"],
            "exist": ["v. 存在"],
            "expand": ["v. 扩大，扩展"],
            "expect": ["v. 期望，预料"],
            "experience": ["n./v. 经验，经历"],
            "experiment": ["n./v. 实验，试验"],
            "explain": ["v. 解释"],
            "explore": ["v. 探索，探究"],
            "expose": ["v. 暴露，揭露"],
            "express": ["v. 表达; n. 快车，快递"],
            "extend": ["v. 延伸，扩展，给予"],
            "extensive": ["adj. 广泛的，大量的"],
            "extra": ["adj. 额外的"],
            "extremely": ["adv. 极其，非常"],
            "factor": ["n. 因素，要素"],
            "familiar": ["adj. 熟悉的"],
            "feature": ["n. 特征，特点; v. 以...为特色"],
            "figure": ["n. 数字，人物，图形; v. 认为，计算"],
            "final": ["adj. 最后的; n. 决赛"],
            "focus": ["n./v. 焦点，集中"],
            "former": ["adj. 以前的，前任的"],
            "frequently": ["adv. 频繁地"],
            "function": ["n. 功能，函数; v. 起作用"],
            "fundamental": ["adj. 基础的，根本的"],
            "further": ["adj./adv. 更远的，进一步的"],
            "generate": ["v. 产生，生成"],
            "global": ["adj. 全球的，总体的"],
            "gradual": ["adj. 逐渐的"],
            "grant": ["v. 授予，同意; n. 拨款"],
            "guarantee": ["n./v. 保证，担保"],
            "handle": ["v. 处理，操作; n. 把手"],
            "harmful": ["adj. 有害的"],
            "hesitate": ["v. 犹豫"],
            "highlight": ["v. 强调，突出; n. 最精彩的部分"],
            "identify": ["v. 识别，确认"],
            "ignore": ["v. 忽视，不理"],
            "illustrate": ["v. 说明，阐明"],
            "image": ["n. 图像，形象"],
            "impact": ["n./v. 影响，冲击"],
            "imply": ["v. 暗示，意味着"],
            "improve": ["v. 改善，提高"],
            "incident": ["n. 事件，事变"],
            "include": ["v. 包括"],
            "increase": ["n./v. 增加"],
            "indicate": ["v. 表明，指示"],
            "individual": ["n. 个人; adj. 个别的，个人的"],
            "industry": ["n. 工业，产业，勤劳"],
            "influence": ["n./v. 影响"],
            "inform": ["v. 通知，告知"],
            "initial": ["adj. 最初的"],
            "injure": ["v. 伤害，损害"],
            "innovation": ["n. 创新，革新"],
            "inquire": ["v. 询问，调查"],
            "insert": ["v. 插入"],
            "insist": ["v. 坚持，坚决要求"],
            "inspect": ["v. 检查，视察"],
            "inspire": ["v. 激励，启发"],
            "install": ["v. 安装，任命"],
            "instance": ["n. 例子，实例"],
            "instead": ["adv. 代替，反而"],
            "institute": ["n. 学会，协会; v. 建立"],
            "instruct": ["v. 指导，指示"],
            "instrument": ["n. 仪器，工具，乐器"],
            "insurance": ["n. 保险"],
            "intend": ["v. 打算，意图"],
            "intention": ["n. 意图，目的"],
            "interest": ["n. 兴趣，利息; v. 使感兴趣"],
            "interpret": ["v. 解释，口译"],
            "interrupt": ["v. 打断，中断"],
            "interview": ["n./v. 面试，采访"],
            "introduce": ["v. 介绍，引进"],
            "invest": ["v. 投资，投入"],
            "investigate": ["v. 调查，研究"],
            "involve": ["v. 涉及，包含，使参与"],
            "issue": ["n. 问题，发行; v. 发行，发布"],
            "item": ["n. 项目，条款，物品"],
            "journal": ["n. 期刊，日记"],
            "judge": ["n. 法官，裁判; v. 判断，评价"],
            "justice": ["n. 正义，公正，司法"],
            "justify": ["v. 证明...正当，为...辩护"],
            "label": ["n. 标签; v. 贴标签"],
            "laboratory": ["n. 实验室"],
            "lack": ["n./v. 缺乏，不足"],
            "latest": ["adj. 最新的，最近的"],
            "launch": ["v. 发起，发射，推出"],
            "lead": ["v. 领导，导致; n. 领导，领先"],
            "league": ["n. 联盟，社团"],
            "lecture": ["n./v. 演讲，讲课"],
            "legal": ["adj. 合法的，法律的"],
            "legislation": ["n. 立法，法规"],
            "leisure": ["n. 闲暇，空闲"],
            "level": ["n. 水平，等级; adj. 平坦的"],
            "liberal": ["adj. 自由的，慷慨的"],
            "limit": ["n./v. 限制，界限"],
            "link": ["n./v. 连接，联系"],
            "locate": ["v. 位于，找出...的位置"],
            "logical": ["adj. 逻辑的，合理的"],
            "major": ["adj. 主要的; n. 专业; v. 主修"],
            "maintain": ["v. 维持，维护，坚持"],
            "majority": ["n. 大多数"],
            "manage": ["v. 管理，设法做到"],
            "manner": ["n. 方式，举止，礼貌"],
            "manual": ["adj. 手工的; n. 手册"],
            "manufacture": ["v./n. 制造，生产"],
            "margin": ["n. 边缘，利润，页边空白"],
            "massive": ["adj. 巨大的，大量的"],
            "master": ["n. 主人，大师; v. 掌握"],
            "match": ["n. 比赛，火柴; v. 匹配"],
            "material": ["n. 材料，物质; adj. 物质的"],
            "matter": ["n. 事情，物质; v. 有关系"],
            "mature": ["adj. 成熟的; v. 成熟"],
            "maximum": ["n./adj. 最大值，最大的"],
            "measure": ["n./v. 测量，措施"],
            "media": ["n. 媒体，媒介"],
            "medical": ["adj. 医学的，医疗的"],
            "mention": ["n./v. 提及，说起"],
            "merely": ["adv. 仅仅，只不过"],
            "method": ["n. 方法"],
            "migrate": ["v. 迁移，移民"],
            "military": ["adj. 军事的; n. 军队"],
            "minority": ["n. 少数，少数民族"],
            "moral": ["adj. 道德的; n. 道德，寓意"],
            "moreover": ["adv. 此外，而且"],
            "motion": ["n. 运动，动作"],
            "motivate": ["v. 激励，激发"],
            "multiple": ["adj. 多个的，多样的"],
            "mutual": ["adj. 相互的，共同的"],
            "mystery": ["n. 神秘，谜"],
            "narrow": ["adj. 狭窄的; v. 变窄，缩小"],
            "nation": ["n. 国家，民族"],
            "native": ["adj. 本地的，天生的"],
            "nature": ["n. 自然，本性"],
            "necessarily": ["adv. 必然地"],
            "negative": ["adj. 消极的，否定的; n. 负数"],
            "neglect": ["v./n. 忽视，疏忽"],
            "negotiate": ["v. 谈判，协商"],
            "neither": ["adj./pron. 两者都不"],
            "nevertheless": ["adv. 然而，不过"],
            "normal": ["adj. 正常的，标准的"],
            "notice": ["n./v. 注意，通知"],
            "notion": ["n. 概念，看法"],
            "nowadays": ["adv. 现今，现在"],
            "object": ["n. 物体，目标; v. 反对"],
            "objective": ["n. 目标; adj. 客观的"],
            "obtain": ["v. 获得，得到"],
            "obvious": ["adj. 明显的"],
            "occasion": ["n. 场合，时机"],
            "occupy": ["v. 占据，使忙碌"],
            "occur": ["v. 发生，出现"],
            "odd": ["adj. 奇怪的，奇数的，临时的"],
            "offend": ["v. 冒犯，得罪"],
            "offer": ["v./n. 提供，提议"],
            "official": ["adj. 官方的; n. 官员"],
            "operate": ["v. 操作，运转，动手术"],
            "opinion": ["n. 意见，看法"],
            "opportunity": ["n. 机会"],
            "oppose": ["v. 反对"],
            "optimistic": ["adj. 乐观的"],
            "option": ["n. 选择，选项"],
            "ordinary": ["adj. 普通的，平常的"],
            "organ": ["n. 器官，机构"],
            "organize": ["v. 组织"],
            "origin": ["n. 起源，出身"],
            "original": ["adj. 原始的，独创的"],
            "otherwise": ["adv. 否则，另外"],
            "outcome": ["n. 结果，成果"],
            "output": ["n. 产量，输出"],
            "outstanding": ["adj. 杰出的，显著的"],
            "overcome": ["v. 克服"],
            "overlook": ["v. 忽视，俯瞰"],
            "owe": ["v. 欠，归功于"],
            "pace": ["n. 步伐，速度; v. 踱步"],
            "package": ["n. 包裹，包装"],
            "painful": ["adj. 痛苦的"],
            "parallel": ["adj. 平行的，类似的; n. 平行线"],
            "participate": ["v. 参加，参与"],
            "particular": ["adj. 特定的，特别的"],
            "passage": ["n. 段落，通道，通过"],
            "patient": ["n. 病人; adj. 耐心的"],
            "pattern": ["n. 模式，图案"],
            "pause": ["n./v. 暂停"],
            "payment": ["n. 付款，支付"],
            "peak": ["n. 山峰，顶点; adj. 最高的"],
            "peculiar": ["adj. 奇怪的，独特的"],
            "perform": ["v. 执行，表演"],
            "performance": ["n. 表现，表演"],
            "period": ["n. 时期，句号"],
            "permanent": ["adj. 永久的，固定的"],
            "permit": ["v. 允许; n. 许可证"],
            "personality": ["n. 个性，人格"],
            "perspective": ["n. 视角，观点，透视"],
            "persuade": ["v. 说服"],
            "phenomenon": ["n. 现象"],
            "policy": ["n. 政策，方针"],
            "positive": ["adj. 积极的，肯定的; n. 正数"],
            "potential": ["adj. 潜在的; n. 潜力"],
            "practical": ["adj. 实际的，实用的"],
            "practice": ["n. 练习，实践"],
            "predict": ["v. 预测"],
            "prefer": ["v. 更喜欢"],
            "prepare": ["v. 准备"],
            "present": ["adj. 现在的，出席的; n. 礼物，现在; v. 呈现，赠送"],
            "preserve": ["v. 保护，保存"],
            "pressure": ["n. 压力，压强; v. 施压"],
            "previous": ["adj. 以前的"],
            "primarily": ["adv. 主要地"],
            "primary": ["adj. 主要的，初级的"],
            "principle": ["n. 原则，原理"],
            "priority": ["n. 优先，优先权"],
            "private": ["adj. 私人的"],
            "probably": ["adv. 可能"],
            "procedure": ["n. 程序，步骤"],
            "proceed": ["v. 继续进行"],
            "process": ["n. 过程; v. 处理"],
            "produce": ["v. 生产，产生; n. 农产品"],
            "profession": ["n. 职业，专业"],
            "professional": ["adj. 专业的"],
            "profit": ["n. 利润; v. 获利"],
            "progress": ["n./v. 进步，进展"],
            "prohibit": ["v. 禁止"],
            "promote": ["v. 促进，提升，推销"],
            "prompt": ["v. 促使; adj. 迅速的"],
            "pronounce": ["v. 发音，宣布"],
            "proof": ["n. 证据，证明"],
            "proper": ["adj. 适当的，正确的"],
            "proportion": ["n. 比例，部分"],
            "propose": ["v. 提议，求婚"],
            "prospect": ["n. 前景，可能性"],
            "protect": ["v. 保护"],
            "prove": ["v. 证明"],
            "provide": ["v. 提供"],
            "province": ["n. 省"],
            "psychology": ["n. 心理学"],
            "publication": ["n. 出版，出版物"],
            "publish": ["v. 出版，发表"],
            "purchase": ["n./v. 购买"],
            "purpose": ["n. 目的"],
            "pursue": ["v. 追求，从事"],
            "puzzle": ["n. 谜，困惑; v. 使困惑"],
            "qualify": ["v. 使合格，限定"],
            "quality": ["n. 质量，品质"],
            "quantity": ["n. 数量"],
            "quit": ["v. 放弃，离开"],
            "quotation": ["n. 引语，报价"],
            "quote": ["v. 引用，报价"],
            "range": ["n. 范围，幅度; v. 变动"],
            "rank": ["n. 等级，军衔; v. 排名"],
            "rare": ["adj. 稀有的，罕见的"],
            "rather": ["adv. 相当，宁愿"],
            "react": ["v. 反应"],
            "reaction": ["n. 反应"],
            "realize": ["v. 意识到，实现"],
            "reasonable": ["adj. 合理的，公道的"],
            "recall": ["v. 回忆，召回"],
            "receive": ["v. 收到，接待"],
            "recently": ["adv. 最近"],
            "recognize": ["v. 认出，承认"],
            "recommend": ["v. 推荐，建议"],
            "recover": ["v. 恢复，找回"],
            "reduce": ["v. 减少"],
            "refer": ["v. 提到，参考，指的是"],
            "reflect": ["v. 反映，反射，反思"],
            "reform": ["n./v. 改革"],
            "refuse": ["v. 拒绝"],
            "regard": ["v. 认为，看待; n. 尊重"],
            "regardless": ["adv. 不顾，无论如何"],
            "region": ["n. 地区，区域"],
            "regret": ["n./v. 后悔，遗憾"],
            "regular": ["adj. 规律的，定期的"],
            "regulate": ["v. 管理，调节"],
            "regulation": ["n. 规章，管理"],
            "reinforce": ["v. 加强，增强"],
            "relate": ["v. 联系，叙述"],
            "relation": ["n. 关系"],
            "relative": ["adj. 相对的; n. 亲戚"],
            "relevant": ["adj. 相关的"],
            "reliable": ["adj. 可靠的"],
            "relief": ["n. 宽慰，救济"],
            "rely": ["v. 依靠，信赖"],
            "remain": ["v. 保持，留下，仍然是"],
            "remark": ["n./v. 评论，注意"],
            "remind": ["v. 提醒，使想起"],
            "remote": ["adj. 遥远的，远程的"],
            "remove": ["v. 移除，去掉"],
            "replace": ["v. 替换，取代"],
            "reply": ["n./v. 回答，回复"],
            "represent": ["v. 代表，象征"],
            "reputation": ["n. 名声，名誉"],
            "request": ["n./v. 请求"],
            "require": ["v. 要求，需要"],
            "requirement": ["n. 要求"],
            "rescue": ["n./v. 营救"],
            "research": ["n./v. 研究"],
            "resemble": ["v. 类似，像"],
            "reserve": ["v. 保留，预订; n. 储备"],
            "resist": ["v. 抵抗，抵制"],
            "resource": ["n. 资源，财力"],
            "respect": ["n./v. 尊重"],
            "respond": ["v. 回应"],
            "response": ["n. 反应，回答"],
            "responsibility": ["n. 责任"],
            "responsible": ["adj. 负责的"],
            "restrict": ["v. 限制"],
            "result": ["n. 结果; v. 导致"],
            "retire": ["v. 退休"],
            "reveal": ["v. 揭示，透露"],
            "review": ["n./v. 复习，评论"],
            "revise": ["v. 修订，复习"],
            "revolution": ["n. 革命"],
            "reward": ["n./v. 奖励，回报"],
            "rid": ["v. 摆脱"],
            "risk": ["n./v. 风险，冒险"],
            "routine": ["n. 常规; adj. 例行的"],
            "ruin": ["n./v. 废墟，毁坏"],
            "sacrifice": ["n./v. 牺牲，祭品"],
            "safety": ["n. 安全"],
            "salary": ["n. 薪水"],
            "satisfy": ["v. 使满意"],
            "schedule": ["n. 日程表; v. 安排"],
            "scholar": ["n. 学者"],
            "scholarship": ["n. 奖学金"],
            "secure": ["adj. 安全的; v. 保护，获得"],
            "seek": ["v. 寻找，寻求"],
            "select": ["v. 选择"],
            "sense": ["n. 感觉，意义; v. 感觉到"],
            "sensitive": ["adj. 敏感的"],
            "separate": ["adj. 分开的; v. 分离"],
            "series": ["n. 系列"],
            "serious": ["adj. 严肃的，严重的"],
            "serve": ["v. 服务，供应"],
            "service": ["n. 服务"],
            "settle": ["v. 定居，解决"],
            "severe": ["adj. 严重的，严厉的"],
            "shadow": ["n. 影子"],
            "sharp": ["adj. 锋利的，急剧的"],
            "shift": ["n./v. 转移，轮班"],
            "shock": ["n./v. 震惊，冲击"],
            "significant": ["adj. 重要的，有意义的"],
            "similar": ["adj. 相似的"],
            "simplify": ["v. 简化"],
            "sincere": ["adj. 真诚的"],
            "situation": ["n. 情况，形势"],
            "skill": ["n. 技能"],
            "slight": ["adj. 轻微的"],
            "social": ["adj. 社会的，社交的"],
            "society": ["n. 社会"],
            "solution": ["n. 解决方案"],
            "solve": ["v. 解决"],
            "sophisticated": ["adj. 复杂的，老练的"],
            "source": ["n. 来源，源头"],
            "specific": ["adj. 具体的，特定的"],
            "spirit": ["n. 精神，心灵"],
            "spiritual": ["adj. 精神的"],
            "split": ["v. 分裂，分开"],
            "sponsor": ["n. 赞助商; v. 赞助"],
            "spot": ["n. 地点，斑点; v. 发现"],
            "spread": ["n./v. 传播，展开"],
            "stable": ["adj. 稳定的; n. 马厩"],
            "standard": ["n. 标准; adj. 标准的"],
            "state": ["n. 状态，国家; v. 陈述"],
            "status": ["n. 地位，状态"],
            "steady": ["adj. 稳定的"],
            "steep": ["adj. 陡峭的"],
            "stick": ["n. 棍子; v. 粘贴，坚持"],
            "stimulate": ["v. 刺激，激励"],
            "strength": ["n. 力量，优势"],
            "stress": ["n./v. 压力，强调"],
            "stretch": ["v. 伸展，延伸"],
            "strike": ["n./v. 罢工，打击"],
            "structure": ["n. 结构"],
            "struggle": ["n./v. 斗争，奋斗"],
            "subject": ["n. 主题，学科，主语; adj. 受...影响的"],
            "submit": ["v. 提交，屈服"],
            "subsequent": ["adj. 随后的"],
            "substitute": ["n. 替代品; v. 代替"],
            "succeed": ["v. 成功，继承"],
            "success": ["n. 成功"],
            "successful": ["adj. 成功的"],
            "suffer": ["v. 遭受，受苦"],
            "suffering": ["n. 苦难"],
            "suggest": ["v. 建议，暗示"],
            "suit": ["n. 西装; v. 适合"],
            "suitable": ["adj. 合适的"],
            "sum": ["n. 总和; v. 总结"],
            "summarize": ["v. 总结"],
            "superior": ["adj. 优越的，上级的"],
            "supply": ["n./v. 供应"],
            "support": ["n./v. 支持"],
            "suppose": ["v. 假设，认为"],
            "surface": ["n. 表面"],
            "surround": ["v. 包围"],
            "survey": ["n./v. 调查，测量"],
            "survive": ["v. 幸存，存活"],
            "suspect": ["v. 怀疑; n. 嫌疑犯"],
            "sustain": ["v. 维持，承受"],
            "swallow": ["v. 吞咽; n. 燕子"],
            "sympathy": ["n. 同情"],
            "system": ["n. 系统"],
            "talent": ["n. 才能，天赋"],
            "target": ["n. 目标; v. 瞄准"],
            "task": ["n. 任务"],
            "technical": ["adj. 技术的"],
            "technique": ["n. 技术，技巧"],
            "technology": ["n. 技术"],
            "temporary": ["adj. 临时的"],
            "tend": ["v. 倾向于，照料"],
            "tendency": ["n. 趋势"],
            "tension": ["n. 紧张"],
            "term": ["n. 学期，术语，条款"],
            "territory": ["n. 领土"],
            "theme": ["n. 主题"],
            "theory": ["n. 理论"],
            "therefore": ["adv. 因此"],
            "thinking": ["n. 思考，想法"],
            "thorough": ["adj. 彻底的"],
            "threat": ["n. 威胁"],
            "threaten": ["v. 威胁"],
            "thus": ["adv. 因此"],
            "tight": ["adj. 紧的"],
            "tiny": ["adj. 微小的"],
            "tissue": ["n. 组织，纸巾"],
            "topic": ["n. 话题"],
            "tough": ["adj. 艰难的，强硬的"],
            "trace": ["n./v. 痕迹，追踪"],
            "track": ["n. 轨道，踪迹; v. 追踪"],
            "trade": ["n./v. 贸易，交易"],
            "tradition": ["n. 传统"],
            "traditional": ["adj. 传统的"],
            "traffic": ["n. 交通"],
            "transfer": ["v. 转移，转学"],
            "transform": ["v. 转变，变形"],
            "translate": ["v. 翻译"],
            "transport": ["n./v. 运输"],
            "trap": ["n. 陷阱; v. 困住"],
            "trend": ["n. 趋势"],
            "trial": ["n. 审判，试验"],
            "trick": ["n. 诡计，窍门"],
            "trouble": ["n./v. 麻烦，烦恼"],
            "trust": ["n./v. 信任"],
            "truth": ["n. 真相"],
            "typical": ["adj. 典型的"],
            "ultimate": ["adj. 最终的，极端的"],
            "undergo": ["v. 经历，遭受"],
            "undergraduate": ["n. 本科生"],
            "underline": ["v. 强调，在...下划线"],
            "understand": ["v. 理解"],
            "undertake": ["v. 承担，从事"],
            "uniform": ["n. 制服; adj. 统一的"],
            "unite": ["v. 联合，统一"],
            "universal": ["adj. 普遍的，宇宙的"],
            "universe": ["n. 宇宙"],
            "unless": ["conj. 除非"],
            "unusual": ["adj. 不寻常的"],
            "update": ["n./v. 更新"],
            "upgrade": ["n./v. 升级"],
            "upset": ["adj. 心烦的; v. 使心烦"],
            "urban": ["adj. 城市的"],
            "urge": ["v. 催促，力劝; n. 冲动"],
            "urgent": ["adj. 紧急的"],
            "useful": ["adj. 有用的"],
            "usual": ["adj. 通常的"],
            "vacation": ["n. 假期"],
            "vague": ["adj. 模糊的"],
            "valid": ["adj. 有效的"],
            "valuable": ["adj. 有价值的"],
            "value": ["n. 价值; v. 重视"],
            "variety": ["n. 多样性，种类"],
            "various": ["adj. 各种各样的"],
            "vary": ["v. 变化，不同"],
            "vast": ["adj. 巨大的"],
            "vehicle": ["n. 车辆"],
            "version": ["n. 版本"],
            "victim": ["n. 受害者"],
            "view": ["n./v. 观点，景色，看待"],
            "violence": ["n. 暴力"],
            "violent": ["adj. 暴力的"],
            "virtue": ["n. 美德，优点"],
            "visible": ["adj. 可见的"],
            "vision": ["n. 视力，视野，愿景"],
            "vital": ["adj. 至关重要的"],
            "vivid": ["adj. 生动的"],
            "volunteer": ["n./v. 志愿者，自愿"],
            "vote": ["n./v. 投票"],
            "wander": ["v. 漫步，走神"],
            "wealth": ["n. 财富"],
            "wealthy": ["adj. 富有的"],
            "weapon": ["n. 武器"],
            "weigh": ["v. 称重，权衡"],
            "weight": ["n. 重量"],
            "welfare": ["n. 福利"],
            "widespread": ["adj. 广泛的"],
            "willing": ["adj. 愿意的"],
            "wind": ["n. 风; v. 蜿蜒"],
            "wisdom": ["n. 智慧"],
            "wise": ["adj. 明智的"],
            "withdraw": ["v. 撤回，提取"],
            "witness": ["n. 证人; v. 目击"],
            "wonder": ["n. 奇迹; v. 想知道"],
            "wonderful": ["adj. 精彩的"],
            "worth": ["adj. 值得的; n. 价值"],
            "worthwhile": ["adj. 值得的"],
            "worthy": ["adj. 值得的，有价值的"],
            "wound": ["n. 伤口; v. 伤害"],
            "youth": ["n. 青春，青年"],
            "sleep": ['n. 睡眠'],
            "tea": ['n. 茶'],
            "language": ['n. 语言'],
            "species": ['n. 物种'],
            "reading": ['n. 阅读'],
            "park": ['n. 公园; v. 停车'],
            "however": ['adv. 然而，不过'],
            "complex": ['adj. 复杂的; n. 建筑群'],
            "season": ['n. 季节; v. 调味'],
            "digital": ['adj. 数字的'],
            "thought": ['n. 思想，想法'],
            "special": ['adj. 特别的，专门的'],
            "please": ['v. 请，使高兴'],
            "discount": ['n. 折扣; v. 打折'],
            "educational": ['adj. 教育的'],
            "biodiversity": ['n. 生物多样性'],
            "alone": ['adj./adv. 独自的，单独的'],
            "today": ['adv./n. 今天'],
            "health": ['n. 健康'],
            "century": ['n. 世纪'],
            "memories": ['n. 记忆（memory的复数）'],
            "services": ['n. 服务（service的复数）'],
            "access": ['n. 通道，获取; v. 进入，使用'],
            "failure": ['n. 失败'],
            "rem": ['n. 快速眼动睡眠阶段'],
            "winter": ['n. 冬季'],
            "animals": ['n. 动物（animal的复数）'],
            "cats": ['n. 猫（cat的复数）'],
            "cat": ['n. 猫'],
            "food": ['n. 食物'],
            "individuals": ['n. 个人，个体（individual的复数）'],
            "learning": ['n. 学习'],
            "wildlife": ['n. 野生动物'],
            "scientists": ['n. 科学家（scientist的复数）'],
            "even": ['adv. 甚至; adj. 平坦的'],
            "workshop": ['n. 研讨会，车间'],
            "garden": ['n. 花园'],
            "provided": ['conj. 假如; v. 提供（provide的过去式）'],
            "hours": ['n. 小时（hour的复数）'],
            "per": ['prep. 每'],
            "solitude": ['n. 孤独，独处'],
            "nostalgia": ['n. 怀旧，乡愁'],
            "english": ['n. 英语; adj. 英国的'],
            "natural": ['adj. 自然的，天然的'],
        }
        return meanings.get(word, ["（含义待补充）"])

    def generate_report(self, top_n: int = 200) -> Dict:
        """生成分析报告"""
        if not self.word_counter:
            self.analyze()

        report = {
            "total_articles": len(self.articles),
            "total_words": sum(self.word_counter.values()),
            "unique_words": len(self.word_counter),
            "top_words": [],
            "top_phrases": self.phrase_counter.most_common(100),
            "coverage": {},
        }

        # 统计词汇覆盖率
        all_words = set(self.word_counter.keys())
        core_covered = all_words & self.CORE_VOCABULARY
        report["coverage"]["core"] = {
            "covered": len(core_covered),
            "total": len(self.CORE_VOCABULARY),
            "rate": round(len(core_covered) / len(self.CORE_VOCABULARY) * 100, 2),
        }

        # Top N 单词分析
        for word, freq in self.word_counter.most_common(top_n):
            wa = WordAnalysis(
                word=word,
                frequency=freq,
                meanings=self.get_word_meaning(word),
                collocations=[],  # 可扩展
                example_sentences=self.word_contexts.get(word, [])[:3],
                pos_hint=self._guess_pos(word),
            )
            report["top_words"].append(asdict(wa))

        return report

    def _guess_pos(self, word: str) -> str:
        """简单推断词性（基于词尾）"""
        if word.endswith('ly'):
            return "adv."
        elif word.endswith('tion') or word.endswith('sion') or word.endswith('ment'):
            return "n."
        elif word.endswith('ness'):
            return "n."
        elif word.endswith('ful') or word.endswith('ous') or word.endswith('ive') or word.endswith('able') or word.endswith('ible'):
            return "adj."
        elif word.endswith('ize') or word.endswith('ise') or word.endswith('ify') or word.endswith('en'):
            return "v."
        elif word.endswith('er') or word.endswith('or'):
            return "n.（人/物）"
        elif word.endswith('ing'):
            return "v./n./adj."
        elif word.endswith('ed'):
            return "v./adj."
        else:
            return "（词性待确定）"

    def save_report(self, report: Dict, output_path: str = "../../data/vocabulary_report.json"):
        """保存报告"""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"\nReport saved to {output_path}")

    def generate_markdown_report(self, report: Dict, output_path: str = "../../data/vocabulary_report.md"):
        """生成 Markdown 格式报告"""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        lines = []
        lines.append("# 高考英语阅读理解 高频词汇分析报告")
        lines.append("")
        lines.append("> 基于四川省高考英语（全国甲卷/四川卷）近10年阅读理解真题文本分析")
        lines.append("> 分析工具：LexiStory Text Analyzer")
        lines.append("")
        lines.append("---")
        lines.append("")

        # 概览
        lines.append("## 一、数据概览")
        lines.append("")
        lines.append(f"- **分析文章数**：{report['total_articles']} 篇")
        lines.append(f"- **总词数**：{report['total_words']} 词")
        lines.append(f"- **不重复词汇**：{report['unique_words']} 个")
        lines.append("")
        cov = report['coverage']['core']
        lines.append(f"- **高中核心词汇覆盖率**：{cov['covered']}/{cov['total']} ({cov['rate']}%)")
        lines.append("")
        lines.append("---")
        lines.append("")

        # 高频短语
        lines.append("## 二、高频短语搭配 TOP 30")
        lines.append("")
        lines.append("高考英语阅读中最常出现的短语搭配：")
        lines.append("")
        lines.append("| 排名 | 短语 | 出现次数 |")
        lines.append("|------|------|----------|")
        for i, (phrase, count) in enumerate(report['top_phrases'][:30], 1):
            lines.append(f"| {i} | {phrase} | {count} |")
        lines.append("")
        lines.append("---")
        lines.append("")

        # 高频词汇
        lines.append("## 三、高频核心词汇 TOP 100")
        lines.append("")
        lines.append("按出现频率排序的高考英语核心词汇：")
        lines.append("")
        lines.append("| 排名 | 单词 | 词性 | 出现次数 | 常见含义 |")
        lines.append("|------|------|------|----------|----------|")
        for i, w in enumerate(report['top_words'][:100], 1):
            meaning = w['meanings'][0] if w['meanings'] else ''
            lines.append(f"| {i} | **{w['word']}** | {w['pos_hint']} | {w['frequency']} | {meaning} |")
        lines.append("")
        lines.append("---")
        lines.append("")

        # 带例句的详细分析（TOP 50）
        lines.append("## 四、重点词汇详解（含真题例句）")
        lines.append("")
        lines.append("以下词汇在高考阅读中高频出现，附有从真题中提取的例句：")
        lines.append("")

        for i, w in enumerate(report['top_words'][:50], 1):
            word = w['word']
            lines.append(f"### {i}. {word} ({w['pos_hint']})")
            lines.append("")
            lines.append(f"- **出现次数**：{w['frequency']} 次")
            if w['meanings']:
                meaning_str = '；'.join(w['meanings'][:3])
                lines.append(f"- **常见含义**：{meaning_str}")
            lines.append("")
            if w['example_sentences']:
                lines.append("- **真题例句**：")
                for sent in w['example_sentences'][:3]:
                    # 高亮单词
                    pattern = r'\b(' + re.escape(word) + r')\b'
                    highlighted = re.sub(pattern, r'**\1**', sent, flags=re.IGNORECASE)
                    lines.append(f"  > {highlighted}")
                lines.append("")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 五、学习建议")
        lines.append("")
        lines.append("1. **优先掌握 TOP 100 高频词**：这些词汇在高考阅读中出现频率最高，是提分的基础")
        lines.append("2. **熟记短语搭配**：高考阅读不仅考单词，更考固定搭配和习语")
        lines.append("3. **结合语境记忆**：通过真题例句理解单词的用法，比死记硬背更有效")
        lines.append("4. **关注一词多义**：高考常考单词的熟词生义，如 `school` 作'学派'，`run` 作'经营'`)")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*报告生成时间：自动生成*")
        lines.append("*数据来源：四川省高考英语真题阅读理解文本*")

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        print(f"Markdown report saved to {output_path}")

    def print_summary(self, report: Dict):
        """打印摘要"""
        print("\n" + "="*60)
        print("           高考英语词汇分析报告")
        print("="*60)
        print(f"分析文章数: {report['total_articles']}")
        print(f"总词数: {report['total_words']}")
        print(f"不重复词数: {report['unique_words']}")
        print(f"\n高中核心词汇覆盖率:")
        cov = report['coverage']['core']
        print(f"  覆盖 {cov['covered']}/{cov['total']} ({cov['rate']}%)")
        print(f"\n高频短语 TOP 20:")
        for phrase, count in report['top_phrases'][:20]:
            print(f"  {phrase}: {count}次")
        print(f"\n高频单词 TOP 30:")
        for i, w in enumerate(report['top_words'][:30], 1):
            print(f"  {i}. {w['word']} ({w['pos_hint']}) - {w['frequency']}次")
        print("="*60)


def main():
    analyzer = TextAnalyzer()
    analyzer.analyze()
    report = analyzer.generate_report(top_n=300)
    analyzer.print_summary(report)
    analyzer.save_report(report)
    analyzer.generate_markdown_report(report)


if __name__ == "__main__":
    main()
