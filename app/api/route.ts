import * as cheerio from "cheerio";
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function doAnalyze(target:string){
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
    length: html.length
  };
}

export async function GET() {
  return Response.json({ ok: true, ping: "up" }, { status: 200 });
}
export async function POST(req: Request) {
  const data = await req.json().catch(()=>({}));
  const url = (data?.url || "").toString().trim();
  if(!url) return Response.json({ ok:false, error:"Missing url" }, { status:400 });
  try{
    const out = await doAnalyze(url);
    return Response.json(out, { status: out.ok ? 200 : (out.status || 500) });
  }catch(e:any){
    return Response.json({ ok:false, error: e?.message || String(e) }, { status:500 });
  }
}
