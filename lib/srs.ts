/**
 * 间隔重复引擎（SM-2 简化版）
 *
 * 单词和语法共用同一套调度状态，这样「到期该复现什么」只有一处逻辑。
 * proficiency 0-3 沿用 PROFICIENCY_LABELS（陌生/认识/熟悉/掌握），
 * 保证既有 UI 不用改就能读。
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

const MIN_EASE = 1.3;
const MAX_EASE = 2.8;
const DEFAULT_EASE = 2.5;
const MAX_INTERVAL_DAYS = 180;

export interface SrsState {
  /** 0=陌生 1=认识 2=熟悉 3=掌握 */
  proficiency: number;
  intervalDays: number;
  ease: number;
  dueAt: number;
  /** 遗忘次数（被判 again 的次数） */
  lapses: number;
  /** 经 coverage 验证的真实出现次数——没在文章里出现过的不算 */
  exposures: number;
  lastReviewedAt: number | null;
  lastSeenInArticleAt: number | null;
}

/**
 * again/hard/good/easy 来自用户的主动判断（点掌握度、答测验）。
 *
 * seen 是被动复现：这个词在用户读过的文章里出现了，但用户没有主动确认认识它。
 * 没有 seen 的话，读过的词永远停在「到期」状态，欠债只增不减——读得越多欠得越多，
 * 首页会显示「今天有 200 个单词到期」然后把人劝退。
 * 所以它也要推后排期，只是步长比主动确认小得多。
 */
export type ReviewGrade = "again" | "hard" | "good" | "easy" | "seen";

/** 被动复现的增长因子，明显小于主动确认时的 ease（2.5） */
const SEEN_FACTOR = 1.6;

/** 单词卡上四个掌握度按钮 → 复习评级 */
export const PROFICIENCY_TO_GRADE: ReviewGrade[] = [
  "again", // 陌生
  "hard",  // 认识
  "good",  // 熟悉
  "easy",  // 掌握
];

export function createSrsState(now: number = Date.now()): SrsState {
  return {
    proficiency: 0,
    intervalDays: 0,
    ease: DEFAULT_EASE,
    dueAt: now,
    lapses: 0,
    exposures: 0,
    lastReviewedAt: null,
    lastSeenInArticleAt: null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 把到期时间对齐到当天零点，避免「差几小时不算到期」的割裂感 */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts: number, days: number): number {
  return ts + Math.round(days * DAY_MS);
}

/**
 * 推进一次复习。
 *
 * again → 当天重来，降 ease，掉一级掌握度
 * hard  → 小步前进，略降 ease
 * good  → 按 ease 增长
 * easy  → 加速增长，升 ease
 */
export function reviewSrs(
  state: SrsState,
  grade: ReviewGrade,
  now: number = Date.now()
): SrsState {
  const next: SrsState = { ...state };
  const prevInterval = state.intervalDays;

  switch (grade) {
    case "again":
      next.ease = clamp(state.ease - 0.2, MIN_EASE, MAX_EASE);
      next.intervalDays = 0;
      next.lapses = state.lapses + 1;
      next.proficiency = Math.max(0, state.proficiency - 1);
      break;

    case "hard":
      next.ease = clamp(state.ease - 0.15, MIN_EASE, MAX_EASE);
      next.intervalDays = prevInterval === 0 ? 1 : Math.max(1, prevInterval * 1.2);
      next.proficiency = clamp(Math.max(state.proficiency, 1), 0, 3);
      break;

    case "good":
      next.intervalDays = prevInterval === 0 ? 1 : prevInterval * state.ease;
      next.proficiency = clamp(Math.max(state.proficiency, 2), 0, 3);
      break;

    case "easy":
      next.ease = clamp(state.ease + 0.15, MIN_EASE, MAX_EASE);
      next.intervalDays = (prevInterval === 0 ? 1 : prevInterval) * state.ease * 1.3;
      next.proficiency = 3;
      break;

    case "seen": {
      // 注意区分「用户明确标过陌生」和「从未评估过」——两者 proficiency 都是 0，
      // 但只有前者应该拒绝往后推。混为一谈的话，所有默认状态的词都会被冻在
      // 1 天间隔上，到期队列永远清不空。
      const explicitlyUnknown =
        state.lastReviewedAt !== null && state.proficiency === 0;
      const factor = explicitlyUnknown ? 1 : SEEN_FACTOR;
      next.intervalDays =
        prevInterval === 0 ? 1 : Math.max(1, prevInterval * factor);
      // proficiency 不变：读到 ≠ 掌握
      break;
    }
  }

  next.intervalDays = Math.min(
    MAX_INTERVAL_DAYS,
    Math.round(next.intervalDays * 100) / 100
  );
  next.dueAt =
    next.intervalDays === 0
      ? now // 当天重来
      : startOfDay(addDays(now, next.intervalDays));
  next.lastReviewedAt = now;

  return next;
}

export function isDue(state: SrsState, now: number = Date.now()): boolean {
  return state.dueAt <= now;
}

/**
 * 紧迫度打分，用于到期队列排序。分越高越该先复现。
 * 逾期越久越紧迫；遗忘过的词更紧迫；已掌握的往后排。
 */
export function urgency(state: SrsState, now: number = Date.now()): number {
  const overdueDays = Math.max(0, (now - state.dueAt) / DAY_MS);
  return (
    overdueDays * 2 +
    state.lapses * 3 +
    (3 - state.proficiency) * 1.5 -
    state.exposures * 0.5
  );
}

export function sortByUrgency<T>(
  items: T[],
  getSrs: (item: T) => SrsState,
  now: number = Date.now()
): T[] {
  return [...items].sort(
    (a, b) => urgency(getSrs(b), now) - urgency(getSrs(a), now)
  );
}

/**
 * 记录一次「在用户读过的文章里真的出现了」。
 *
 * 既累计曝光，也按 seen 档推后排期——被动复现同样是一次复习，
 * 不推后的话到期队列只进不出。
 */
export function recordExposure(
  state: SrsState,
  now: number = Date.now()
): SrsState {
  const advanced = reviewSrs(state, "seen", now);
  return {
    ...advanced,
    // seen 不算主动复习，不改 lastReviewedAt
    lastReviewedAt: state.lastReviewedAt,
    exposures: state.exposures + 1,
    lastSeenInArticleAt: now,
  };
}

/**
 * 从老数据的 proficiency 播种一个 SRS 状态（迁移用）。
 * anchor 通常是 lastReviewedAt ?? addedAt。
 */
export function seedSrsFromProficiency(
  proficiency: number,
  anchor: number,
  opts: { reviewCount?: number; dueAt?: number } = {}
): SrsState {
  const p = clamp(Math.round(proficiency), 0, 3);
  const intervalByProficiency = [1, 2, 4, 8];
  const intervalDays = intervalByProficiency[p];

  return {
    proficiency: p,
    intervalDays,
    ease: DEFAULT_EASE,
    dueAt: opts.dueAt ?? startOfDay(addDays(anchor, intervalDays)),
    lapses: 0,
    exposures: opts.reviewCount ?? 0,
    lastReviewedAt: null,
    lastSeenInArticleAt: null,
  };
}

/** 人话描述下次复习时间，给 UI 用 */
export function describeDue(state: SrsState, now: number = Date.now()): string {
  const diffDays = Math.round((state.dueAt - startOfDay(now)) / DAY_MS);
  if (diffDays <= 0) return "今天到期";
  if (diffDays === 1) return "明天";
  if (diffDays < 30) return `${diffDays} 天后`;
  const months = Math.round(diffDays / 30);
  return `约 ${months} 个月后`;
}
