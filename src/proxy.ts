import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

/**
 * /llms.txt and /ai/* are force-static, so nothing runs per-request in
 * production and GA4 (client-side JS) never fires for raw-markdown fetchers
 * (bots, curl, LLM tools). This proxy is the only place that sees every
 * real hit to those paths, so it fires a fire-and-forget log call before
 * letting the static response through.
 *
 * Also covers /2026/llms.txt and /2026/ai/* — that path is rewritten
 * (next.config.ts) to the nav-poc deployment via an external URL fetch, and
 * that fetch doesn't reliably trigger nav-poc's own proxy (confirmed
 * empirically 2026-08-05: hits to never-before-cached /2026/ai/cases/*
 * paths never showed up in the sheet even after nav-poc got its own
 * matching proxy). Catching it here, before the rewrite happens, works.
 */
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const logPromise = fetch(new URL("/api/log-hit", request.nextUrl.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: request.nextUrl.pathname,
      user_agent: request.headers.get("user-agent") || "",
      referer: request.headers.get("referer") || "",
      ip: request.headers.get("x-forwarded-for") || "",
    }),
  }).catch(() => {});

  event.waitUntil(logPromise);

  return NextResponse.next();
}

export const config = {
  matcher: ["/llms.txt", "/ai/:path*", "/2026/llms.txt", "/2026/ai/:path*"],
};
