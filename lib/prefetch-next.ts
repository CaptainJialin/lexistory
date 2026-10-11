/**
 * 后台预生成下一篇。
 *
 * 在阅读页调用——用户正在读，正好用这段时间把下一篇算好。
 * 全程静默：失败不提示、不阻塞、不影响当前阅读。
 */

import { getProgress } from "./storage";
import { buildLessonPlan } from "./lesson-plan";
import { generateArticleFromPlan } from "./generate-article";
import {
  getPrefetched,
  isPrefetchValid,
  savePrefetched,
  type PrefetchedLesson,
} from "./prefetch";
import { notifyDataChanged } from "./client-store";

/** 同一次会话里避免重复触发 */
let inFlight = false;

export async function prefetchNextLesson(): Promise<void> {
  if (typeof window === "undefined" || inFlight) return;

  const progress = getProgress();
  // 已经有一份还能用的就别再花钱生成了
  if (isPrefetchValid(getPrefetched(), progress)) return;

  const plan = buildLessonPlan({ progress });
  if (plan.words.length === 0 || plan.grammars.length === 0) return;

  inFlight = true;
  try {
    // save:false —— 用户没点开就不该进历史记录
    const article = await generateArticleFromPlan(plan, { save: false });

    const lesson: PrefetchedLesson = {
      article,
      progress: progress
        ? {
            bookId: progress.bookId,
            gradeId: progress.gradeId,
            unitId: progress.unitId,
          }
        : null,
      summary: plan.summary,
      notes: plan.notes,
      wordRoles: Object.fromEntries(
        plan.words.map((s) => [s.item.word.toLowerCase(), s.role])
      ),
      grammarNames: plan.grammars.map((s) => ({
        name: s.item.name,
        role: s.role,
      })),
      createdAt: Date.now(),
    };

    savePrefetched(lesson);
    notifyDataChanged();
  } catch {
    // 预生成失败无所谓，首页会照常走实时生成
  } finally {
    inFlight = false;
  }
}
