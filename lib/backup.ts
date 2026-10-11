/**
 * 数据备份与恢复
 *
 * LexiStory 的全部数据都在 localStorage 里，清一次缓存就没了。
 * 这里提供全量快照、JSON 导出/导入，作为迁移和误操作的逃生舱。
 */

export const STORAGE_PREFIX = "lexistory_";
export const SCHEMA_VERSION_KEY = "lexistory_schema_version";
export const CURRENT_SCHEMA_VERSION = 3;

/** 快照 key 不参与快照本身，否则会套娃 */
const SNAPSHOT_KEY_PREFIX = "lexistory_backup_v";

export interface BackupPayload {
  app: "lexistory";
  schemaVersion: number;
  exportedAt: number;
  data: Record<string, string>;
}

function isBackupKey(key: string): boolean {
  return key.startsWith("lexistory_backup_");
}

/** 收集所有 lexistory_* 的原始字符串（不含备份快照本身） */
export function collectStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX) || isBackupKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return data;
}

export function getSchemaVersion(): number {
  if (typeof window === "undefined") return CURRENT_SCHEMA_VERSION;
  const raw = localStorage.getItem(SCHEMA_VERSION_KEY);
  if (raw === null) {
    // 没有版本号：要么全新用户，要么是 v1 老数据
    return localStorage.getItem("lexistory_articles") ||
      localStorage.getItem("lexistory_wordbook")
      ? 1
      : 0;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

export function setSchemaVersion(version: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SCHEMA_VERSION_KEY, String(version));
}

/**
 * 在破坏性操作（迁移）之前留一份快照。
 * 同一个版本只快照一次，避免迁移失败重跑时把好数据覆盖成坏数据。
 */
export function snapshotBeforeMigration(fromVersion: number): void {
  if (typeof window === "undefined") return;
  const key = `${SNAPSHOT_KEY_PREFIX}${fromVersion}`;
  if (localStorage.getItem(key)) return;

  const payload: BackupPayload = {
    app: "lexistory",
    schemaVersion: fromVersion,
    exportedAt: Date.now(),
    data: collectStorage(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    // 配额爆了也不能挡住迁移，但要留痕
    console.error("[lexistory] 备份快照写入失败：", error);
  }
}

export function getSnapshot(version: number): BackupPayload | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${SNAPSHOT_KEY_PREFIX}${version}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BackupPayload;
  } catch {
    return null;
  }
}

/** 回滚到某个版本的快照。仅在用户明确要求时调用。 */
export function restoreSnapshot(version: number): boolean {
  const snapshot = getSnapshot(version);
  if (!snapshot) return false;

  for (const key of Object.keys(collectStorage())) {
    localStorage.removeItem(key);
  }
  for (const [key, value] of Object.entries(snapshot.data)) {
    localStorage.setItem(key, value);
  }
  setSchemaVersion(snapshot.schemaVersion);
  return true;
}

// ====== 导出 / 导入 ======

export function buildBackup(): BackupPayload {
  return {
    app: "lexistory",
    schemaVersion: getSchemaVersion(),
    exportedAt: Date.now(),
    data: collectStorage(),
  };
}

/** 触发浏览器下载一个 JSON 备份文件 */
export async function downloadBackup(): Promise<void> {
  if (typeof window === "undefined") return;
  const payload = buildBackup();
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
    const file = await Filesystem.writeFile({ path: `lexistory-backup-${Date.now()}.json`, data: JSON.stringify(payload, null, 2), directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: "LexiStory 学习备份", files: [file.uri], dialogTitle: "保存学习备份" });
    return;
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date(payload.exportedAt)
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-");

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lexistory-backup-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export interface ImportResult {
  ok: boolean;
  message: string;
  restoredKeys?: number;
}

const PRE_IMPORT_KEY = "lexistory_backup_pre_import";
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown) => Array.isArray(value) && value.every((v) => typeof v === "string");
const arrayOf = (value: unknown, check: (entry: Record<string, unknown>) => boolean) => Array.isArray(value) && value.every((entry) => object(entry) && check(entry));
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);

/** Reject malformed records before any destructive writes. Old schema versions still migrate. */
function validateValue(key: string, value: unknown): boolean {
  switch (key) {
    case "lexistory_articles": return arrayOf(value, (a) => typeof a.id === "string" && typeof a.title === "string" && typeof a.content === "string" && typeof a.translation === "string" && finite(a.createdAt) && object(a.difficulty) && typeof a.difficulty.gradeId === "string" && arrayOf(a.words, (w) => typeof w.word === "string") && arrayOf(a.grammar, (g) => typeof g.id === "string" && typeof g.name === "string") && (a.sentences === undefined || arrayOf(a.sentences, (s) => typeof s.sentence === "string")) && (a.quiz === undefined || arrayOf(a.quiz, (q) => typeof q.id === "string" && typeof q.question === "string" && strings(q.options) && finite(q.correctIndex))));
    case "lexistory_wordbook": return arrayOf(value, (w) => typeof w.id === "string" && typeof w.word === "string" && finite(w.proficiency) && finite(w.addedAt));
    case "lexistory_grammarbook": return arrayOf(value, (g) => typeof g.grammarId === "string" && object(g.srs) && finite(g.srs.proficiency) && arrayOf(g.encounteredIn, (e) => typeof e.articleId === "string" && strings(e.sentences)));
    case "lexistory_profile": return object(value) && Array.isArray(value.history) && arrayOf(value.history, (h) => typeof h.articleId === "string" && finite(h.readAt) && strings(h.words) && strings(h.grammarIds)) && finite(value.totalArticles) && finite(value.streakDays);
    case "lexistory_progress": return object(value) && typeof value.bookId === "string" && typeof value.gradeId === "string" && typeof value.unitId === "string" && strings(value.completedUnits);
    case "lexistory_quizzes": return arrayOf(value, (q) => typeof q.articleId === "string" && finite(q.score) && strings(q.wrongQuestions));
    case "lexistory_reading_progress": return object(value) && Object.values(value).every((p) => object(p) && finite(p.updatedAt) && (p.sentenceIndex === undefined || finite(p.sentenceIndex)));
    case "lexistory_daily_goal": return object(value) && typeof value.date === "string" && finite(value.articlesRead) && finite(value.reviewsDone);
    case "lexistory_quiz_grades": return object(value) && Object.values(value).every((day) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day));
    default: return value !== null;
  }
}

export function inspectBackup(json: string): { payload: BackupPayload; articles: number; words: number } {
  if (json.length > 20 * 1024 * 1024) throw new Error("备份超过 20 MB，请检查文件是否正确。");
  let payload: unknown;
  try { payload = JSON.parse(json); } catch { throw new Error("文件不是合法的 JSON。"); }
  if (!object(payload) || payload.app !== "lexistory" || !object(payload.data)) throw new Error("这不是有效的 LexiStory 备份。");
  if (!Number.isInteger(payload.schemaVersion) || Number(payload.schemaVersion) < 1 || Number(payload.schemaVersion) > CURRENT_SCHEMA_VERSION) throw new Error("备份版本不受支持，请使用相同或更新版本的 LexiStory。");
  const data = payload.data;
  if (!Object.keys(data).some((key) => ["lexistory_articles", "lexistory_wordbook", "lexistory_profile", "lexistory_progress", "lexistory_grammarbook"].includes(key))) throw new Error("备份没有可恢复的学习数据。");
  for (const [key, raw] of Object.entries(data)) {
    if (!key.startsWith(STORAGE_PREFIX) || isBackupKey(key) || typeof raw !== "string") throw new Error("备份包含不合法的数据项。");
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error(`备份中的 ${key} 已损坏。`); }
    if (!validateValue(key, value)) throw new Error(`备份中的 ${key} 格式不正确。`);
    if (key === SCHEMA_VERSION_KEY && value !== payload.schemaVersion) throw new Error("备份版本信息不一致。");
  }
  return { payload: payload as unknown as BackupPayload, articles: JSON.parse(String(data.lexistory_articles || "[]")).length, words: JSON.parse(String(data.lexistory_wordbook || "[]")).length };
}

export function hasImportRecovery(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(PRE_IMPORT_KEY) !== null;
}

export function undoLastImport(): ImportResult {
  const snapshot = localStorage.getItem(PRE_IMPORT_KEY);
  if (!snapshot) return { ok: false, message: "没有导入前的快照。" };
  // The current import becomes the new recovery point, so recovery is reversible too.
  return importBackup(snapshot);
}

/**
 * 从导出的 JSON 恢复数据。
 * mode="replace" 清空现有数据后写入；mode="merge" 只补上当前没有的 key。
 */
export function importBackup(
  json: string,
  mode: "replace" | "merge" = "replace"
): ImportResult {
  if (typeof window === "undefined") {
    return { ok: false, message: "仅支持在浏览器中导入" };
  }

  let payload: BackupPayload;
  try {
    payload = inspectBackup(json).payload;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "备份验证失败。" };
  }

  if (payload?.app !== "lexistory" || typeof payload.data !== "object") {
    return { ok: false, message: "这不是 LexiStory 的备份文件" };
  }

  const previous = collectStorage();
  try {
  // A fresh recovery point for every import; a migration snapshot may be months old.
  localStorage.setItem(PRE_IMPORT_KEY, JSON.stringify(buildBackup()));
  if (mode === "replace") {
    for (const key of Object.keys(collectStorage())) {
      localStorage.removeItem(key);
    }
  }

  let restoredKeys = 0;
  for (const [key, value] of Object.entries(payload.data)) {
    if (!key.startsWith(STORAGE_PREFIX) || isBackupKey(key)) continue;
    if (mode === "merge" && localStorage.getItem(key) !== null) continue;
    if (typeof value !== "string") continue;
    localStorage.setItem(key, value);
    restoredKeys++;
  }

  setSchemaVersion(payload.schemaVersion ?? 1);

  return {
    ok: true,
    message: `已恢复 ${restoredKeys} 项数据`,
    restoredKeys,
  };
  } catch {
    for (const key of Object.keys(collectStorage())) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(previous)) localStorage.setItem(key, value);
    return { ok: false, message: "导入未完成，存储空间可能不足。原有学习数据已保留。" };
  }
}
