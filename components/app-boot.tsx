"use client";

import { useEffect } from "react";
import { runMigrations } from "@/lib/migrate";

/**
 * 启动时跑一次数据迁移。
 * 迁移是幂等的，已是最新版本会直接返回。
 */
export function AppBoot() {
  useEffect(() => {
    const report = runMigrations();
    if (report.ran && report.from > 0) {
      console.info(
        `[lexistory] 数据已从 v${report.from} 迁移到 v${report.to}`,
        report
      );
    }
  }, []);

  return null;
}
