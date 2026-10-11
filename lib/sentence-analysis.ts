/**
 * 句子主干提取。
 *
 * 考研长难句的标准解法是「先剥掉修饰找主干，再把修饰挂回去」——
 * 认识每个词却读不懂整句，几乎都是卡在没找到主干。
 *
 * 我们已经让模型标了成分（主语/谓语/宾语/状语/定语从句…），
 * 但一直只是罗列，从没做最关键的那一步综合。这里从已有标注里
 * 筛掉修饰成分，把核心骨架拼出来——不用改 prompt，也不用重新生成，
 * 已有文章立刻就能用。
 */

import { SentenceConstituent } from "./types";

/**
 * 修饰性成分的标签特征。
 * 命中任意一个就从主干里剔除。
 */
const MODIFIER_PATTERNS = [
  "状语", // 状语 / 时间状语从句 / 让步状语从句 / 伴随状语 / 目的状语 ...
  "定语", // 定语 / 定语从句
  "同位语", // 同位语 / 同位语从句
  "插入语",
  "连接词",
];

/** 这个成分是修饰性的吗 */
export function isModifier(label: string): boolean {
  return MODIFIER_PATTERNS.some((p) => label.includes(p));
}

export interface MainClause {
  /** 主干文本 */
  text: string;
  /** 组成主干的成分 */
  parts: SentenceConstituent[];
  /** 被剥掉的修饰成分 */
  stripped: SentenceConstituent[];
  /** 剥掉了多少词 */
  strippedWords: number;
}

/**
 * 提取主干。
 *
 * 返回 null 表示提不出有意义的主干——没标注、或者标注里根本没有主谓，
 * 这时不如不显示，免得给出一个残缺的"主干"误导人。
 */
export function extractMainClause(
  sentence: string,
  constituents?: SentenceConstituent[]
): MainClause | null {
  if (!constituents || constituents.length === 0) return null;

  // 按在原句中的位置排序，保证拼出来的顺序和原文一致
  const positioned = constituents
    .map((c) => ({ ...c, start: sentence.indexOf(c.text) }))
    .filter((c) => c.start !== -1)
    .sort((a, b) => a.start - b.start);

  if (positioned.length === 0) return null;

  const parts = positioned.filter((c) => !isModifier(c.label));
  const stripped = positioned.filter((c) => isModifier(c.label));

  // 没有谓语的"主干"没有意义
  const hasPredicate = parts.some(
    (c) => c.label.includes("谓语") || c.label.includes("系动词")
  );
  if (!hasPredicate) return null;

  // 一个修饰都没剥掉说明这句本来就是主干，没必要单独展示
  if (stripped.length === 0) return null;

  const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  return {
    text: parts.map((c) => c.text).join(" "),
    parts: parts.map(({ text, label }) => ({ text, label })),
    stripped: stripped.map(({ text, label }) => ({ text, label })),
    strippedWords: stripped.reduce((sum, c) => sum + countWords(c.text), 0),
  };
}
