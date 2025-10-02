import * as cheerio from "cheerio";
import { NextResponse } from "next/server";
import { scoreLanding } from "../../src/lib/scoring";

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

// GET: unterstützt optional &goal=... &fields=...
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const target = (u.searchParams.get("url") || "").toString().trim();
    if (!target) {
      return NextResponse.json({ ok: true, ping: "up" }, { status: 200 });
    }
    const out = await analyze(target);

    // Optional: Funnel und Felder aus Query
    const goalParam = u.searchParams.get("goal") || undefined;
    const fieldsParam = u.searchParams.get("fields");
    const fieldsNum = fieldsParam ? Number(fieldsParam) : undefined;

    const signals = {
      h1: out.h1 ?? undefined,
      pageTitle: out.title ?? undefined,
      httpStatusOk: out.ok,
      funnelGoal: goalParam as any,
      formFieldsCount: Number.isFinite(fieldsNum as number) ? (fieldsNum as number) : undefined,
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

    const signals = {
      h1: out.h1 ?? undefined,
      pageTitle: out.title ?? undefined,
      httpStatusOk: out.ok,
      formFieldsCount: (body.formFieldsCount ?? undefined) as number | undefined,
      funnelGoal: (body.funnelGoal ?? undefined) as string | undefined,
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
