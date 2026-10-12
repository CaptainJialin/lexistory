/**
 * 每日目标。
 *
 * 现在读完一篇文章没有任何完成感——streak 只是个数字，没有任何东西建立在它上面。
 * 日更类产品的留存靠的就是「今天的事做完了」这个明确信号。
 *
 * 目标刻意定得很低（一篇 + 若干复习）：能天天完成的目标才有意义，
 * 定高了只会让人第三天就放弃。
 */

import { getProfile, recordStudyDay } from "./recommend";
import { localDateKey } from "./calendar";
import { countClozeAvailable } from "./cloze";

const GOAL_KEY = "lexistory_daily_goal";

/**
 * 每天的复习目标上限。
 *
 * 刻意压得比"到期量"低很多：填空要逐个打字，10 个就是好几分钟。
 * 把它设成每天必须完成的量，反而会挤掉"每天读一篇"这个核心习惯。
 */
const REVIEW_TARGET_CAP = 5;

/**
 * 阅读在总进度里的权重。
 *
 * 读一篇文章是今天最重的一件事，不能和一个填空题等权重——
 * 否则读完整篇只推进 1/11，进度条几乎不动，人会觉得白干了。
 */
const ARTICLE_WEIGHT = 0.7;

export interface DailyGoal {
  /** YYYY-MM-DD */
  date: string;
  articlesRead: number;
  reviewsDone: number;
  articleIds?: string[];
  reviewTarget?: number;
}

export interface DailyProgress {
  articlesRead: number;
  articleTarget: number;
  reviewsDone: number;
  reviewTarget: number;
  /**
   * 今日主目标（读一篇）已达成。
   * 复习是加分项，没做完也算今天的事做完了——核心习惯是每天读一篇，
   * 不该因为没刷够填空题就告诉用户今天没完成。
   */
  complete: boolean;
  /** 阅读 + 复习都做满了 */
  allDone: boolean;
  /** 0-100，阅读占大头 */
  percent: number;
}

function today(now: number = Date.now()): string {
  return localDateKey(now);
}

function readGoal(): DailyGoal | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(GOAL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DailyGoal;
  } catch {
    return null;
  }
}

function writeGoal(goal: DailyGoal): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}

/** 取今天的计数；跨天自动归零 */
function currentGoal(now: number = Date.now()): DailyGoal {
  const stored = readGoal();
  const date = today(now);
  if (stored && stored.date === date) return stored;
  return { date, articlesRead: 0, reviewsDone: 0 };
}

export function recordArticleReadForGoal(articleId: string, now: number = Date.now()): void {
  const goal = currentGoal(now);
  if (goal.articleIds?.includes(articleId)) return;
  writeGoal({ ...goal, articlesRead: goal.articlesRead + 1, articleIds: [...(goal.articleIds ?? []), articleId] });
}

export function recordReviewForGoal(count: number = 1, now: number = Date.now()): void {
  const goal = currentGoal(now);
  writeGoal({ ...goal, reviewsDone: goal.reviewsDone + count });
  if (count > 0) recordStudyDay(now);
}

/** Freeze the attainable target before grading changes what is due. */
export function beginDailyReview(now: number = Date.now()): void {
  const goal = currentGoal(now);
  if (goal.reviewTarget !== undefined) return;
  writeGoal({ ...goal, reviewTarget: Math.min(REVIEW_TARGET_CAP, goal.reviewsDone + countClozeAvailable(now).due) });
}

/**
 * 今日进度。
 *
 * 复习目标按实际可练的量来定——没词可练时不该显示一个永远完不成的目标。
 */
export function getDailyProgress(now: number = Date.now()): DailyProgress {
  const goal = currentGoal(now);

  const available = countClozeAvailable(now);
  const reviewTarget = goal.reviewTarget ?? Math.min(REVIEW_TARGET_CAP, goal.reviewsDone + available.due);

  const articleTarget = 1;
  const articleDone = Math.min(goal.articlesRead, articleTarget);
  const reviewDone = Math.min(goal.reviewsDone, reviewTarget);

  const articleRatio = articleDone / articleTarget;
  const reviewRatio = reviewTarget === 0 ? 1 : reviewDone / reviewTarget;

  // 没有复习任务时，阅读就是全部
  const percent =
    reviewTarget === 0
      ? Math.round(articleRatio * 100)
      : Math.round(
          (articleRatio * ARTICLE_WEIGHT + reviewRatio * (1 - ARTICLE_WEIGHT)) * 100
        );

  return {
    articlesRead: goal.articlesRead,
    articleTarget,
    reviewsDone: goal.reviewsDone,
    reviewTarget,
    complete: articleDone >= articleTarget,
    allDone: articleDone >= articleTarget && reviewDone >= reviewTarget,
    percent,
  };
}

// ====== 数据安全提醒 ======

const BACKUP_REMINDER_KEY = "lexistory_backup_reminded_at";
/** 攒到这个量级还没备份过就提醒一次 */
const REMIND_AFTER_ARTICLES = 5;
const REMIND_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * 该不该提醒备份。
 *
 * 数据只在这台设备的 localStorage 里，清个缓存就全没了，而导出入口埋在
 * 统计页底部——没人会主动去找。攒到一定量时主动提醒一次。
 */
export function shouldRemindBackup(now: number = Date.now()): boolean {
  if (typeof window === "undefined") return false;

  const profile = getProfile();
  if (profile.totalArticles < REMIND_AFTER_ARTICLES) return false;

  const raw = localStorage.getItem(BACKUP_REMINDER_KEY);
  if (!raw) return true;

  const last = Number.parseInt(raw, 10);
  if (!Number.isFinite(last)) return true;
  return now - last > REMIND_INTERVAL_MS;
}

export function markBackupReminded(now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BACKUP_REMINDER_KEY, String(now));
}
