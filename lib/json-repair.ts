/**
 * LLM JSON 响应的提取与修复。
 *
 * 最常见的失败不是格式写错，而是 **被 max_tokens 截断**——响应在字符串中间
 * 或数组元素中间戛然而止。这时整个 JSON 都解析不了，用户等了一分钟只拿到
 * 一句「AI returned malformed JSON」，之前生成的正文也一起丢了。
 *
 * repairTruncated() 会回退到最后一个完整元素，补齐括号，把「全丢」降级成
 * 「少几句解析」。
 */

/** 从可能带 markdown 包裹的文本里取出 JSON 主体 */
export function extractJson(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim();
    if (inner.startsWith("{")) return inner;
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  const trimmed = text.trim();
  return trimmed.startsWith("{") ? trimmed : null;
}

/** 修掉 LLM 常见的小毛病：尾逗号、字符串里的裸换行 */
export function fixCommonJsonErrors(text: string): string {
  return text
    .replace(/,\s*(\]|\})/g, "$1")
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)\n([^"]*?)"/g, '"$1\\n$2"')
    .replace(/"([^"\\]*(?:\\.[^"\\]*)*)\t([^"]*?)"/g, '"$1\\t$2"');
}

/**
 * 修复被截断的 JSON。
 *
 * 扫描全文并记录「最后一个完整值结束的位置」及该位置的括号栈，
 * 从那里截断、去掉尾逗号、按栈补齐闭合括号。
 * 截断处那个残缺的元素会被丢弃——宁可少一句解析，也好过整篇报废。
 */
export function repairTruncated(text: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  // 最后一个「完整值」的结束位置（下标 +1）及当时的括号栈
  let safeEnd = -1;
  let safeStack: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      // 一个对象/数组刚闭合，这里一定是完整值的边界
      safeEnd = i + 1;
      safeStack = [...stack];
    } else if (ch === ",") {
      // 逗号说明前一个值已经完整，在这里切（不含逗号本身）。
      // 只认闭合括号是不够的：截断如果发生在第一个嵌套结构闭合之前，
      // 就会连已经写好的 title / content / translation 一起丢掉。
      safeEnd = i;
      safeStack = [...stack];
    }
  }

  // 完全没有闭合过任何结构，救不回来
  if (safeEnd === -1) return null;

  let body = text.slice(0, safeEnd).replace(/,\s*$/, "");
  // 补齐仍然打开的括号（由内向外）
  for (let i = safeStack.length - 1; i >= 0; i--) {
    body += safeStack[i];
  }

  return body;
}

export interface ParseResult<T> {
  ok: boolean;
  data?: T;
  /** 是否走了截断修复（数据可能不完整） */
  repaired: boolean;
  error?: string;
}

/**
 * 尽最大努力把 LLM 的响应解析成对象。
 * 依次尝试：直接解析 → 修常见小错 → 截断修复。
 */
export function parseLlmJson<T = unknown>(raw: string): ParseResult<T> {
  const cleaned = extractJson(raw);
  if (!cleaned) {
    return { ok: false, repaired: false, error: "响应中找不到 JSON" };
  }

  try {
    return { ok: true, data: JSON.parse(cleaned) as T, repaired: false };
  } catch {
    // 继续尝试
  }

  try {
    return {
      ok: true,
      data: JSON.parse(fixCommonJsonErrors(cleaned)) as T,
      repaired: false,
    };
  } catch {
    // 继续尝试
  }

  // 截断修复：先在原始文本上做（extractJson 取到 lastIndexOf("}") 时
  // 可能已经把结构切坏了，原文更可信）
  for (const candidate of [raw, cleaned]) {
    const start = candidate.indexOf("{");
    if (start === -1) continue;
    const repaired = repairTruncated(candidate.slice(start));
    if (!repaired) continue;
    try {
      return { ok: true, data: JSON.parse(repaired) as T, repaired: true };
    } catch {
      try {
        return {
          ok: true,
          data: JSON.parse(fixCommonJsonErrors(repaired)) as T,
          repaired: true,
        };
      } catch {
        // 换下一个候选
      }
    }
  }

  return { ok: false, repaired: false, error: "JSON 解析失败且无法修复" };
}
