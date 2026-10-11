/** 掌握度 0-3 对应的配色，单词本 / 文章页 / 语法本共用 */
export const PROFICIENCY_COLORS = [
  "bg-red-50 text-red-700 border-red-200",
  "bg-orange-50 text-orange-700 border-orange-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-green-50 text-green-700 border-green-200",
];

/**
 * quiz 题型标签。
 * 前三个是早期的通用类型，老文章还在用；后五个对应考研阅读的真实题型。
 */
export const QUIZ_TYPE_LABELS: Record<string, string> = {
  "word-meaning": "词汇",
  "grammar-fill": "语法",
  "reading-comprehension": "阅读理解",
  "vocabulary-in-context": "词义猜测",
  detail: "细节理解",
  inference: "推理判断",
  "main-idea": "主旨大意",
  attitude: "态度观点",
};

/**
 * 去掉选项里的字母前缀。
 *
 * 模型有时会返回 "A. unchangeable"，而 UI 自己会渲染 A/B/C/D 角标，
 * 两者叠加就成了「A  A. unchangeable」。prompt 里已明确禁止，
 * 这里再兜一层，顺便修正已经生成的老文章。
 */
export function stripOptionPrefix(option: string): string {
  // 分隔符后的空格是可选的——全角标点（D、valuable）后面通常不带空格。
  // 字符类里不含字母和空格，所以 "Apple" / "A widely accepted theory" 不会被误伤。
  return option.replace(/^\s*[（(]?[A-Da-d][)）.、:：]\s*/, "").trim();
}

/** 新学 / 复现 的配色 */
export const ROLE_COLORS = {
  new: "border-blue-200 bg-blue-50 text-blue-700",
  review: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const;
