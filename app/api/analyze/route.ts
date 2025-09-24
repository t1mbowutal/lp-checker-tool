import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic"; // prevent caching during build

type Payload = { url?: string };

function normalizeUrl(input: string): string | null {
  try {
    const u = new URL(input.startsWith("http") ? input : `https://${input}`);
    return u.toString();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: Payload = {};
  try {
    body = await req.json();
  } catch {}

  const normalized = body.url ? normalizeUrl(body.url) : null;
  if (!normalized) {
    return NextResponse.json({ ok: false, url: body.url ?? "", status: null, durationMs: 0, issues: ["Invalid URL"] }, { status: 400 });
  }

  const started = Date.now();
  let html = "";
  let status: number | null = null;
  try {
    const res = await fetch(normalized, {
      // ensure Node.js runtime
      // @ts-expect-error
      cache: "no-store"
    });
    status = res.status;
    html = await res.text();
  } catch (e) {
    const durationMs = Date.now() - started;
    return NextResponse.json({ ok: false, url: normalized, status: null, durationMs, issues: ["Fetch failed (server couldn't reach the URL)."] }, { status: 200 });
  }
  const durationMs = Date.now() - started;

  let title: string | null = null;
  let description: string | null = null;
  let canonical: string | null = null;
  let h1Count = 0;
  const issues: string[] = [];

  if (html) {
    const $ = cheerio.load(html);
    title = ($("title").first().text() || "").trim() || null;
    description = ($("meta[name='description']").attr("content") || "").trim() || null;
    canonical = ($("link[rel='canonical']").attr("href") || "").trim() || null;
    h1Count = $("h1").length;

    if (!title) issues.push("Missing <title> tag.");
    if (!description) issues.push("Missing meta description.");
    if (h1Count === 0) issues.push("No <h1> found — add a clear main headline.");
    if (!canonical) issues.push("No canonical tag detected.");
    if (status && (status < 200 || status >= 400)) issues.push(`Non-2xx HTTP status: ${status}.`);

    // Simple CTA heuristic: count anchor tags with common CTA labels
    const ctaLabels = ["buy", "get started", "book", "contact", "demo", "trial", "angebot", "kaufen", "anfrage", "jetzt", "start", "subscribe"];
    const ctaCount = $("a, button").filter((_, el) => {
      const text = $(el).text().toLowerCase().trim();
      return ctaLabels.some(l => text.includes(l));
    }).length;
    if (ctaCount === 0) issues.push("No obvious CTA found — consider adding a primary CTA.");

    // Very small HTML check
    if (html.length < 512) issues.push("Page HTML is extremely small — did the site block the request or return a redirect?");
  }

  return NextResponse.json({
    ok: true,
    url: normalized,
    status,
    durationMs,
    title,
    description,
    canonical,
    h1Count,
    issues
  });
}
