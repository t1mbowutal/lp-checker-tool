
import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

const weights = {
  title: 10,
  metaDescription: 10,
  h1: 10,
  h2Structure: 5,
  canonical: 5,
  ogTags: 5,
  viewport: 5,
  imagesAlt: 10,
  ctaPresence: 15,
  ctaAboveFold: 10,
  contentLength: 10,
  trustSignals: 5
};

export async function POST(req: NextRequest){
  try{
    const { url } = await req.json();
    if(!url || typeof url !== 'string') return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 lp-checker' } });
    const html = await res.text();
    const $ = cheerio.load(html);

    const checks: any[] = [];
    const add = (key: string, label: string, ok: boolean, details: string, partialScore = ok ? 1 : 0) => {
      const weight = (weights as any)[key] ?? 0;
      const score = Math.round(partialScore * weight);
      checks.push({ key, label, ok, details, weight, score });
    };

    // Title
    const title = $('title').text().trim();
    const titleLen = title.length;
    const titleOk = titleLen >= 30 && titleLen <= 65;
    add('title', 'Title length 30–65', titleOk, `Title len ${titleLen}`);

    // Meta description
    const md = $('meta[name="description"]').attr('content') || '';
    const mdLen = md.trim().length;
    const mdOk = mdLen >= 80 && mdLen <= 160;
    add('metaDescription', 'Meta description 80–160', mdOk, `Meta len ${mdLen}`);

    // H1
    const h1s = $('h1');
    add('h1', 'Single H1 present', h1s.length === 1, `H1 count ${h1s.length}`);

    // H2 structure
    const h2Count = $('h2').length;
    add('h2Structure', 'H2 structure present (>=2)', h2Count >= 2, `H2 count ${h2Count}`, Math.min(1, h2Count / 4));

    // Canonical
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    add('canonical', 'Canonical tag present', !!canonical, canonical || 'missing');

    // OG tags
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogOk = !!(ogTitle && ogDesc && ogImage);
    add('ogTags', 'OpenGraph basic tags', ogOk, `og:title=${!!ogTitle}, og:desc=${!!ogDesc}, og:image=${!!ogImage}`, ogOk ? 1 : 0);

    // Viewport
    const viewport = $('meta[name="viewport"]').attr('content') || '';
    add('viewport', 'Responsive viewport meta', viewport.includes('width=device-width'), viewport || 'missing');

    // Images with alt
    const imgs = $('img');
    let withAlt = 0;
    imgs.each((_, el) => { if($(el).attr('alt')) withAlt++; });
    const altRatio = imgs.length ? withAlt / imgs.length : 1;
    add('imagesAlt', 'Images have alt text (>=80%)', altRatio >= 0.8, `alt ${withAlt}/${imgs.length}`, altRatio);

    // CTA presence (heuristic)
    const ctaRegex = /(kaufen|bestellen|angebot|angebot anfordern|kontakt|kontaktieren|demo|test|trial|get|buy|subscribe|request|contact|angebot|preis|quote)/i;
    let ctaCount = 0;
    $('a,button').each((_, el) => {
      const t = $(el).text().trim().toLowerCase();
      if (ctaRegex.test(t)) ctaCount++;
    });
    add('ctaPresence', 'CTA present (>=1)', ctaCount >= 1, `CTA count ${ctaCount}`, ctaCount ? Math.min(1, ctaCount/3) : 0);

    // CTA above fold (approx: first 1500 chars)
    const bodyText = $('body').text().replace(/\s+/g,' ').trim();
    const first1500 = bodyText.slice(0, 1500).toLowerCase();
    const ctaAboveFold = ctaRegex.test(first1500);
    add('ctaAboveFold', 'CTA visible early', ctaAboveFold, ctaAboveFold ? '✓' : 'not obvious');

    // Content length
    const textLen = bodyText.length;
    const contentOk = textLen >= 1200;
    let contentPartial = 0;
    if(textLen >= 1200 && textLen < 3000) contentPartial = 0.7;
    if(textLen >= 3000) contentPartial = 1;
    add('contentLength', 'Sufficient textual depth', contentOk, `Text length ~${textLen}`, contentPartial);

    // Trust signals (keywords)
    const trustRegex = /(kunden|referenzen|testimonial|stimmen|bewertungen|reviews|partner|zertifiziert|iso|safety|compliance|datenschutz|gdpr|iso\s*9001)/i;
    const trustOk = trustRegex.test(bodyText.toLowerCase());
    add('trustSignals', 'Trust signals present', trustOk, trustOk ? '✓' : 'none found');

    const totalWeight = checks.reduce((a:any,c:any)=>a + c.weight, 0);
    const totalScore = checks.reduce((a:any,c:any)=>a + c.score, 0);
    const scorePct = Math.round((totalScore / totalWeight) * 100);

    // Management Summary
    const issues = checks.filter(c => c.score < c.weight * 0.6).map(c => c.label);
    const wins = checks.filter(c => c.score >= c.weight * 0.9).map(c => c.label);
    const summary = [
      `Score: ${scorePct}/100 – ${scorePct >= 80 ? 'Strong' : scorePct >= 60 ? 'Decent' : 'Needs work'}.`,
      wins.length ? `What works: ${wins.join(', ')}.` : 'What works: basic structure present.',
      issues.length ? `Fix next: ${issues.join(', ')}.` : 'Fix next: iterate on conversion depth & testing.'
    ].join(' ');

    return NextResponse.json({ url, score: scorePct, checks, summary });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || 'Analysis failed' }, { status: 500 });
  }
}
