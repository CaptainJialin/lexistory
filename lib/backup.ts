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
  return key.startsWith(SNAPSHOT_KEY_PREFIX);
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
export function downloadBackup(): void {
  if (typeof window === "undefined") return;
  const payload = buildBackup();
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
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  ok: boolean;
  message: string;
  restoredKeys?: number;
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
    payload = JSON.parse(json) as BackupPayload;
  } catch {
    return { ok: false, message: "文件不是合法的 JSON" };
  }

  if (payload?.app !== "lexistory" || typeof payload.data !== "object") {
    return { ok: false, message: "这不是 LexiStory 的备份文件" };
  }

  // 导入本身也是破坏性的，先给当前数据留一份
  snapshotBeforeMigration(getSchemaVersion());

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
}
