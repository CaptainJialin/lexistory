/** Website uses same-origin APIs; the bundled mobile client uses its deployed backend. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (process.env.NEXT_PUBLIC_MOBILE_BUILD === "true" && !base) {
    throw new Error("联网学习服务暂未连接。你仍可以阅读已保存的文章和体验故事。");
  }
  const timeout = AbortSignal.timeout(90000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    return await fetch(`${base}${path}`, { ...options, signal });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timeout.aborted) throw new Error("这次准备得有点久，请稍后重试。你的学习记录仍然保留。");
    throw new Error("暂时连接不上服务，请检查网络后重试。");
  }
}
