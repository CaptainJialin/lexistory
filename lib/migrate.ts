/**
 * 版本化数据迁移
 *
 * 全部数据都在 localStorage，迁移必须幂等、可回滚、且不能把老用户砸晕。
 * 最关键的一点见 STAGGER_PER_DAY：老版本的 saveArticle() 会把每篇文章的所有词
 * 无条件灌进单词本，所以老用户可能积压了几百个 proficiency=0 的词。如果直接
 * 按掌握度算到期，第一天会有几百个词同时到期。这里把它们摊到未来若干天。
 */

import {
  Article,
  GrammarBookEntry,
  UserProgress,
  QuizResult,
  WordBookEntry,
  GRAMMAR_OPTIONS,
} from "./types";
import { seedSrsFromProficiency, createSrsState, startOfDay, addDays } from "./srs";
import { resolveGrammarId, isPlausibleGrammarTag } from "./coverage";
import {
  CURRENT_SCHEMA_VERSION,
  getSchemaVersion,
  setSchemaVersion,
  snapshotBeforeMigration,
} from "./backup";

const WORDBOOK_KEY = "lexistory_wordbook";
const GRAMMARBOOK_KEY = "lexistory_grammarbook";
const ARTICLES_KEY = "lexistory_articles";
const PROGRESS_KEY = "lexistory_progress";
const PROFILE_KEY = "lexistory_profile";
const QUIZ_KEY = "lexistory_quizzes";

/** 每天最多让多少个积压词到期，避免迁移当天雪崩 */
const STAGGER_PER_DAY = 15;

/**
 * Bug 修复：教材 "pep-senior" 实为考研大纲，却复用了表示高一/高二/高三的
 * s1/s2/s3。已在 official-words.ts 更正，这里改写已存的用户数据。
 */
const LEGACY_BOOK_ID = "pep-senior";
const LEGACY_GRADE_MAP: Record<string, string> = { s1: "g1", s2: "g2", s3: "g3" };
const LEGACY_UNIT_MAP: Record<string, string> = {
  "s1-u1": "ge-g1-u1",
  "s1-u2": "ge-g1-u2",
  "s2-u1": "ge-g2-u1",
  "s3-u1": "ge-g3-u1",
};

/**
 * v3：考研核心词教材从手写的 18 单元（360 词）换成生成式的 30 单元（750 词）。
 * 老的 g1-u1 这类单元 id 已经不存在了，按位置映射到新的 gv-x-yy，
 * 否则老用户打开会停在一个查不到的单元上。
 */
const GRADUATE_CORE_UNIT_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const stage of [1, 2, 3]) {
    for (let u = 1; u <= 6; u++) {
      map[`g${stage}-u${u}`] = `gv-${stage}-${String(u).padStart(2, "0")}`;
    }
  }
  return map;
})();

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ====== 各迁移步骤 ======

/** 给单词本补 srs，并把积压的到期时间摊开 */
function migrateWordBook(now: number): number {
  const book = read<WordBookEntry[]>(WORDBOOK_KEY);
  if (!Array.isArray(book) || book.length === 0) return 0;

  // 掌握度低的、加得早的排前面，先到期
  const ordered = [...book].sort((a, b) => {
    const pa = a.proficiency ?? 0;
    const pb = b.proficiency ?? 0;
    if (pa !== pb) return pa - pb;
    return (a.addedAt ?? 0) - (b.addedAt ?? 0);
  });

  const today = startOfDay(now);
  const staggeredDue = new Map<string, number>();
  ordered.forEach((entry, index) => {
    staggeredDue.set(entry.id, addDays(today, Math.floor(index / STAGGER_PER_DAY)));
  });

  let migrated = 0;
  const next = book.map((entry) => {
    if (entry.srs) return entry;
    migrated++;
    const anchor = entry.lastReviewedAt ?? entry.addedAt ?? now;
    const seeded = seedSrsFromProficiency(entry.proficiency ?? 0, anchor, {
      reviewCount: entry.reviewCount ?? 0,
    });
    // 已掌握的按正常间隔走；未掌握的用错峰到期，避免第一天雪崩
    const dueAt =
      (entry.proficiency ?? 0) >= 3
        ? seeded.dueAt
        : Math.max(seeded.dueAt, staggeredDue.get(entry.id) ?? today);

    return {
      ...entry,
      srs: { ...seeded, dueAt },
      source: entry.source ?? "article",
      seenIn: entry.seenIn ?? [],
    };
  });

  write(WORDBOOK_KEY, next);
  return migrated;
}

/** 从历史文章回填语法本，让老用户一进来语法本就不是空的 */
function backfillGrammarBook(now: number): number {
  const existing = read<GrammarBookEntry[]>(GRAMMARBOOK_KEY);
  if (Array.isArray(existing) && existing.length > 0) return 0;

  const articles = read<Article[]>(ARTICLES_KEY);
  if (!Array.isArray(articles) || articles.length === 0) return 0;

  const byId = new Map<string, GrammarBookEntry>();

  // 从最早的文章开始，addedAt 才符合真实学习顺序
  const chronological = [...articles].sort(
    (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)
  );

  for (const article of chronological) {
    for (const grammar of article.grammar ?? []) {
      if (!GRAMMAR_OPTIONS.some((g) => g.id === grammar.id)) continue;

      let entry = byId.get(grammar.id);
      if (!entry) {
        entry = {
          grammarId: grammar.id,
          srs: createSrsState(article.createdAt ?? now),
          addedAt: article.createdAt ?? now,
          encounteredIn: [],
        };
        byId.set(grammar.id, entry);
      }

      // 老数据的 sentences[].grammars 没有 grammarId，按中文名回退匹配。
      // 同样要过滤模型的错标，否则语法讲解页会展示错误用例。
      const sentences = (article.sentences ?? [])
        .filter((s) =>
          (s.grammars ?? []).some((g) => {
            const id = g.grammarId ?? resolveGrammarId(g.name, article.grammar);
            return (
              id === grammar.id &&
              isPlausibleGrammarTag(id, s.sentence, g.explanation)
            );
          })
        )
        .map((s) => s.sentence);

      entry.encounteredIn.push({ articleId: article.id, sentences });
      entry.srs = {
        ...entry.srs,
        exposures: entry.srs.exposures + 1,
        lastSeenInArticleAt: article.createdAt ?? now,
      };
    }
  }

  // 回填出来的语法同样错峰到期
  const entries = [...byId.values()].sort((a, b) => a.addedAt - b.addedAt);
  const today = startOfDay(now);
  entries.forEach((entry, index) => {
    entry.srs.intervalDays = 2;
    entry.srs.dueAt = addDays(today, Math.floor(index / 3));
  });

  write(GRAMMARBOOK_KEY, entries);
  return entries.length;
}

/** 改写误标的 pep-senior 教材 id / 年级 id / 单元 id */
function migrateLegacyBookIds(): number {
  let changed = 0;

  const progress = read<UserProgress>(PROGRESS_KEY);
  if (progress && progress.bookId === LEGACY_BOOK_ID) {
    const next: UserProgress = {
      ...progress,
      bookId: "graduate-exam",
      gradeId: LEGACY_GRADE_MAP[progress.gradeId] ?? progress.gradeId,
      unitId: LEGACY_UNIT_MAP[progress.unitId] ?? progress.unitId,
      completedUnits: (progress.completedUnits ?? []).map(
        (u) => LEGACY_UNIT_MAP[u] ?? u
      ),
      unitStates: Object.fromEntries(
        Object.entries(progress.unitStates ?? {}).map(([unitId, state]) => [
          LEGACY_UNIT_MAP[unitId] ?? unitId,
          state,
        ])
      ),
    };
    write(PROGRESS_KEY, next);
    changed++;
  }

  const articles = read<Article[]>(ARTICLES_KEY);
  if (Array.isArray(articles)) {
    let touched = false;
    const next = articles.map((article) => {
      if (article.source?.bookId !== LEGACY_BOOK_ID) return article;
      touched = true;
      return {
        ...article,
        source: {
          ...article.source,
          bookId: "graduate-exam",
          gradeId: LEGACY_GRADE_MAP[article.source.gradeId] ?? article.source.gradeId,
          unitId: LEGACY_UNIT_MAP[article.source.unitId] ?? article.source.unitId,
        },
      };
    });
    if (touched) {
      write(ARTICLES_KEY, next);
      changed++;
    }
  }

  const quizzes = read<QuizResult[]>(QUIZ_KEY);
  if (Array.isArray(quizzes)) {
    let touched = false;
    const next = quizzes.map((q) => {
      const mapped = LEGACY_UNIT_MAP[q.unitId];
      if (!mapped) return q;
      touched = true;
      return { ...q, unitId: mapped };
    });
    if (touched) {
      write(QUIZ_KEY, next);
      changed++;
    }
  }

  return changed;
}

/** v3：把老的 graduate-core 单元 id 映射到新词表的单元 id */
function migrateGraduateCoreUnits(): number {
  let changed = 0;
  const remap = (unitId: string) => GRADUATE_CORE_UNIT_MAP[unitId] ?? unitId;

  const progress = read<UserProgress>(PROGRESS_KEY);
  if (progress?.bookId === "graduate-core") {
    const next: UserProgress = {
      ...progress,
      unitId: remap(progress.unitId),
      completedUnits: (progress.completedUnits ?? []).map(remap),
      unitStates: Object.fromEntries(
        Object.entries(progress.unitStates ?? {}).map(([unitId, state]) => [
          remap(unitId),
          state,
        ])
      ),
    };
    write(PROGRESS_KEY, next);
    changed++;
  }

  const articles = read<Article[]>(ARTICLES_KEY);
  if (Array.isArray(articles)) {
    let touched = false;
    const next = articles.map((article) => {
      if (article.source?.bookId !== "graduate-core") return article;
      const mapped = remap(article.source.unitId);
      if (mapped === article.source.unitId) return article;
      touched = true;
      return { ...article, source: { ...article.source, unitId: mapped } };
    });
    if (touched) {
      write(ARTICLES_KEY, next);
      changed++;
    }
  }

  return changed;
}

/** wordMastery / grammarMastery 已被 SRS 取代，从档案里移除 */
function pruneProfile(): boolean {
  const profile = read<Record<string, unknown>>(PROFILE_KEY);
  if (!profile) return false;
  if (!("wordMastery" in profile) && !("grammarMastery" in profile)) return false;

  delete profile.wordMastery;
  delete profile.grammarMastery;
  write(PROFILE_KEY, profile);
  return true;
}

// ====== 入口 ======

export interface MigrationReport {
  from: number;
  to: number;
  ran: boolean;
  wordsMigrated: number;
  grammarsBackfilled: number;
  legacyIdsRewritten: number;
  graduateUnitsRemapped: number;
  profilePruned: boolean;
}

/**
 * 在 app 启动时调用一次。幂等：已是最新版本直接返回。
 */
export function runMigrations(now: number = Date.now()): MigrationReport {
  const from = getSchemaVersion();
  const report: MigrationReport = {
    from,
    to: CURRENT_SCHEMA_VERSION,
    ran: false,
    wordsMigrated: 0,
    grammarsBackfilled: 0,
    legacyIdsRewritten: 0,
    graduateUnitsRemapped: 0,
    profilePruned: false,
  };

  if (typeof window === "undefined") return report;
  if (from >= CURRENT_SCHEMA_VERSION) return report;

  // 全新用户（version 0）没有数据要迁，直接打版本号
  if (from === 0) {
    setSchemaVersion(CURRENT_SCHEMA_VERSION);
    return { ...report, ran: true };
  }

  // 动任何数据之前先留快照
  snapshotBeforeMigration(from);

  try {
    report.wordsMigrated = migrateWordBook(now);
    report.grammarsBackfilled = backfillGrammarBook(now);
    report.legacyIdsRewritten = migrateLegacyBookIds();
    report.graduateUnitsRemapped = migrateGraduateCoreUnits();
    report.profilePruned = pruneProfile();
    report.ran = true;
    setSchemaVersion(CURRENT_SCHEMA_VERSION);
  } catch (error) {
    // 不打版本号，下次启动会带着快照重试
    console.error("[lexistory] 迁移失败，数据已保留在备份快照中：", error);
  }

  return report;
}
