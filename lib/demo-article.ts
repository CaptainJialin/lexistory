import { Article, GRAMMAR_OPTIONS } from "./types";
import { getArticleById, saveArticle } from "./storage";

export function openDemoArticle(): string {
  const id = "lexistory-first-story";
  if (getArticleById(id)) return id;
  const sentences = [
    { sentence: "Every morning, Mia takes a different path to school.", translation: "每天早上，米娅走不同的路去学校。", constituents: [{ text: "Mia", label: "主语" }, { text: "takes", label: "谓语" }, { text: "a different path", label: "宾语" }], grammars: [{ name: "一般现在时", grammarId: "simple-present", explanation: "takes 描述经常发生的事；主语是第三人称单数，动词加 -s。" }], difficultWords: [{ word: "path", meaning: "小路；路线", partOfSpeech: "n." }], phrases: [{ phrase: "a different path", meaning: "一条不同的路" }] },
    { sentence: "She is curious about the small things that other people miss.", translation: "她对别人忽略的小事充满好奇。", difficultWords: [{ word: "curious", meaning: "好奇的", partOfSpeech: "adj." }], phrases: [{ phrase: "be curious about", meaning: "对……感到好奇" }] },
    { sentence: "One day, she finds a tiny garden behind an old bookshop.", translation: "有一天，她在一家老书店后面发现了一座小花园。", difficultWords: [{ word: "tiny", meaning: "微小的", partOfSpeech: "adj." }], phrases: [{ phrase: "behind an old bookshop", meaning: "在一家老书店后面" }] },
    { sentence: "An old man tells her that every flower begins with a little seed, just as every big change begins with a small step.", translation: "一位老人告诉她，每朵花都始于一颗小种子，就像每个大的改变都始于一小步。", difficultWords: [{ word: "seed", meaning: "种子", partOfSpeech: "n." }], phrases: [{ phrase: "begin with", meaning: "以……开始" }], constituents: [{ text: "An old man", label: "主语" }, { text: "tells", label: "谓语" }, { text: "her", label: "间接宾语" }, { text: "that every flower begins with a little seed, just as every big change begins with a small step", label: "宾语从句" }] },
  ];
  const article: Article = {
    id, isDemo: true, title: "A Small Step", createdAt: Date.now(),
    content: sentences.slice(0, 2).map((s) => s.sentence).join(" ") + "\n\n" + sentences.slice(2).map((s) => s.sentence).join(" "),
    translation: "米娅每天用不同的路线去发现生活中的小事。一天，一座小花园让她明白：不必等到准备好一切，一个小小的开始就足够了。",
    words: [{ word: "path", meaning: "小路；路线" }, { word: "curious", meaning: "好奇的", phrases: ["be curious about"] }, { word: "tiny", meaning: "微小的" }, { word: "seed", meaning: "种子" }],
    grammar: GRAMMAR_OPTIONS.filter((g) => g.id === "simple-present"),
    difficulty: { level: "junior", gradeId: "j1" }, theme: "story", sentences,
    quiz: [
      { id: "sample-1", type: "detail", question: "Where does Mia find the garden?", options: ["Behind a bookshop.", "Inside her school.", "Near her house.", "On a mountain."], correctIndex: 0, explanation: "第三句明确说花园位于 an old bookshop 后面。" },
      { id: "sample-2", type: "vocabulary-in-context", question: "What does ‘curious’ mean in this story?", options: ["Too tired to walk.", "Wanting to discover more.", "Afraid of new places.", "Always in a hurry."], correctIndex: 1, explanation: "Mia 会留意别人忽略的小事，curious 表示好奇、想了解更多。" },
      { id: "sample-3", type: "main-idea", question: "What is the main message of the story?", options: ["Take the same path every day.", "Big changes must happen quickly.", "Small beginnings can lead to big changes.", "Only old people can grow flowers."], correctIndex: 2, explanation: "老人用种子和花作比喻：大的改变从一小步开始。" },
    ],
  };
  saveArticle(article);
  return id;
}
