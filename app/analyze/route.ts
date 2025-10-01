import * as cheerio from "cheerio";
import { NextResponse } from "next/server";
import { scoreLanding } from "../lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function analyze(target: string) {
  const res = await fetch(target, {
    headers: {
      "user-agent": "LP-Checker/1.0 (+lp-checker-tool.vercel.app)",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  const html = await res.text();
  const $ = cheerio.load(html);

  return {
    ok: res.ok,
    status: res.status,
    url: target,
    title: $("title").first().text() || null,
    metaDescription: $('meta[name="description"]').attr("content") || null,
    h1: $("h1").first().text() || null,
    canonical: $('link[rel="canonical"]').attr("href") || null,
    length: html.length,
  };
}

// GET: Ping oder Analyse per ?url=...
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const target = (u.searchParams.get("url") || "").toString().trim();
    if (!target) {
      return NextResponse.json({ ok: true, ping: "up" }, { status: 200 });
    }
    const out = await analyze(target);

    // Scoring einhängen (optional bei GET)
    const signals = {
      h1: out.h1,
      pageTitle: out.title,
      httpStatusOk: out.ok,
    };
    const score = scoreLanding(signals);

    return NextResponse.json({ ...out, scoring: score }, { status: out.ok ? 200 : (out.status || 500) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

// POST: nimmt body.json mit { url, formFieldsCount?, funnelGoal? }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const target = (body?.url || "").toString().trim();
    if (!target) {
      return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });
    }

    const out = await analyze(target);

    // Signale fürs Scoring
    const signals = {
      h1: out.h1,
      pageTitle: out.title,
      httpStatusOk: out.ok,
      formFieldsCount: body.formFieldsCount ?? null,
      funnelGoal: body.funnelGoal ?? null,
    };

    const score = scoreLanding(signals);

    return NextResponse.json(
      { ...out, scoring: score },
      { status: out.ok ? 200 : (out.status || 500) }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}