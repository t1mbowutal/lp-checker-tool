import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

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
  try { body = await req.json(); } catch {}

  const normalized = body.url ? normalizeUrl(body.url) : null;
  if (!normalized) {
    return NextResponse.json({ ok:false, url: body.url??"", status:null, durationMs:0, issues:["Invalid URL"] },{status:400});
  }

  const started = Date.now();
  let html = "";
  let status: number | null = null;
  try {
    const res = await fetch(normalized, { cache:"no-store" });
    status = res.status;
    html = await res.text();
  } catch {
    const durationMs = Date.now()-started;
    return NextResponse.json({ ok:false, url:normalized, status:null, durationMs, issues:["Fetch failed"] });
  }
  const durationMs = Date.now()-started;

  let title=null, description=null, canonical=null; let h1Count=0; const issues:string[]=[];
  if (html) {
    const $ = cheerio.load(html);
    title = ($("title").first().text()||"").trim()||null;
    description = ($("meta[name='description']").attr("content")||"").trim()||null;
    canonical = ($("link[rel='canonical']").attr("href")||"").trim()||null;
    h1Count = $("h1").length;
    if (!title) issues.push("Missing <title>");
    if (!description) issues.push("Missing description");
    if (h1Count===0) issues.push("No <h1> found");
    if (!canonical) issues.push("No canonical tag");
  }

  return NextResponse.json({ ok:true, url:normalized, status, durationMs, title, description, canonical, h1Count, issues });
}
