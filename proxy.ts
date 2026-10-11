import { NextRequest, NextResponse } from "next/server";

const buckets = new Map<string, { count: number; expires: number }>();
const nativeOrigins = new Set(["capacitor://localhost", "https://localhost", "http://localhost"]);

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowed = origin && (origin === request.nextUrl.origin || nativeOrigins.has(origin));
  let response: NextResponse;
  if (origin && !allowed) response = NextResponse.json({ error: "不支持的请求来源。" }, { status: 403 });
  else if (request.method === "OPTIONS") response = new NextResponse(null, { status: 204 });
  else {
    // A per-process backstop. Production needs authenticated, shared quotas as well.
    const now = Date.now();
    for (const [key, value] of buckets) if (value.expires <= now) buckets.delete(key);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const key = `${ip}:${request.nextUrl.pathname}`;
    const bucket = buckets.get(key) ?? { count: 0, expires: now + 60000 };
    bucket.count++;
    if (buckets.size < 5000 || buckets.has(key)) buckets.set(key, bucket);
    response = bucket.count > (request.nextUrl.pathname === "/api/speech" ? 30 : 12)
      ? NextResponse.json({ error: "操作有些频繁，请一分钟后再试。" }, { status: 429, headers: { "Retry-After": "60" } })
      : NextResponse.next();
  }
  if (allowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.append("Vary", "Origin");
  }
  return response;
}

export const config = { matcher: "/api/:path*" };
