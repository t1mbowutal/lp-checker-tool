import * as cheerio from "cheerio";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Analysis = {
  ok: boolean;
  url?: string;
  status?: number;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  canonical?: string | null;
  hasHttps?: boolean;
  length?: number;
  errors?: string[];
};

async function analyzeUrl(target: string): Promise<Analysis> {
  const errors: string[] = [];
  try {
    const res = await fetch(target, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; LP-Checker/1.0; +https://lp-checker-tool.vercel.app)",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      // don't cache
      cache: "no-store",
    });

    const status = res.status;
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $("title").first().text() || null;
    const metaDescription = $('meta[name="description"]').attr("content") || null;
    const h1 = $("h1").first().text() || null;
    const canonical = $('link[rel="canonical"]').attr("href") || null;
    const hasHttps = target.startsWith("https://");
    const length = html.length;

    return {
      ok: status >= 200 && status < 400,
      url: target,
      status,
      title,
      metaDescription,
      h1,
      canonical,
      hasHttps,
      length,
      errors,
    };
  } catch (e:any) {
    errors.push(e?.message || String(e));
    return { ok: false, errors };
  }
}

export async function GET() {
  return Response.json({ ok: true, ping: "lp-checker api up" }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const url = (body?.url || body?.URL || body?.u || "").toString().trim();
    if (!url) {
      return Response.json({ ok: false, error: "Missing 'url' in body" }, { status: 400 });
    }
    const result = await analyzeUrl(url);
    return Response.json(result, { status: result.ok ? 200 : (result.status || 500) });
  } catch (err:any) {
    return Response.json({ ok: false, error: err?.message || "unknown error" }, { status: 500 });
  }
}
