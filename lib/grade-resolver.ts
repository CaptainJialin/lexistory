/**
 * 年级/难度的统一解析。
 *
 * 收编了原先散落在 app/page.tsx、app/article/page.tsx、app/history/page.tsx 三处的
 * GRADUATE_BOOK_GRADE_MAP / LEGACY_GRADUATE_LABELS / inferGradeOption 补丁。
 *
 * 补丁存在的原因：教材 "pep-senior" 实为考研大纲却复用了表示高一/高二/高三的
 * s1/s2/s3。数据已在 official-words.ts 更正、用户数据由 migrate.ts 改写，
 * 但**已生成的老文章**里 difficulty.gradeId 仍可能是 s1-s3 且 style 为 exam-graduate，
 * 所以显示层还需要这一层兼容。
 */

import {
  Article,
  GradeOption,
  GRADE_OPTIONS,
  LEVEL_LABELS,
  getGradeById,
} from "./types";

/** 老文章里 style=exam-graduate 时，s1/s2/s3 实际指考研三阶段 */
const LEGACY_GRADUATE_GRADE_IDS: Record<string, string> = {
  s1: "g1",
  s2: "g2",
  s3: "g3",
};

function isLegacyGraduateArticle(article: Article): boolean {
  return (
    article.style === "exam-graduate" &&
    article.difficulty.gradeId in LEGACY_GRADUATE_GRADE_IDS
  );
}

/** 解析一篇文章真正对应的年级定义（含老数据兼容） */
export function resolveArticleGrade(article: Article): GradeOption | undefined {
  const gradeId = isLegacyGraduateArticle(article)
    ? LEGACY_GRADUATE_GRADE_IDS[article.difficulty.gradeId]
    : article.difficulty.gradeId;

  return getGradeById(gradeId) ?? getGradeById(article.difficulty.gradeId);
}

/** 文章卡片上显示的难度标签 */
export function getArticleStudyLabel(article: Article): string {
  if (article.source) {
    return `${article.source.gradeName} · ${article.source.unitName}`;
  }

  const grade = resolveArticleGrade(article);
  if (!grade) return "未知难度";

  return `${LEVEL_LABELS[grade.level]}${grade.name} · ${grade.cefr}`;
}

/**
 * 由 gradeId 取年级定义。
 * 替代 app/page.tsx 里那份手抄的 inferGradeOption 映射表。
 */
export function resolveGrade(gradeId: string): GradeOption {
  return (
    getGradeById(gradeId) ??
    GRADE_OPTIONS.find((g) => g.id === "j2")!
  );
}
