import * as cheerio from 'cheerio';
import { scoreLanding } from '../../../src/lib/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NOTE: Next.js Route files may only export specific fields (GET/POST/etc.).
// So this stays internal (no export).
function scoringLogicVersion() {
  const sha = (process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
  return sha ? sha.slice(0, 7) : 'local';
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clean(s: string) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => clean(x)).filter(Boolean)));
}

function slugKeywords(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    const raw = last
      .replace(/\.html?$/i, '')
      .split(/[-_]/g)
      .map((x) => x.toLowerCase())
      .filter((x) => x.length >= 3);

    const stop = new Set([
      'and',
      'the',
      'with',
      'your',
      'for',
      'from',
      'into',
      'bring',
      'you',
      'de',
      'en',
      'us',
      'eu',
      'page',
      'landing',
      'lp',
      'in',
      'to',
      'of',
      'der',
      'die',
      'das',
      'und',
      'mit',
      'für',
      'aus',
      'zum',
      'zur',
      'ein',
      'eine',
    ]);

    return raw.filter((x) => !stop.has(x)).slice(0, 8);
  } catch {
    return [];
  }
}

function gatherCtas($: any) {
  const nodes = $('a, button, input[type="submit"], input[type="button"], [role="button"]');
  const items = nodes
    .map((_: any, el: any) => {
      const t = clean($(el).text() || $(el).attr('value') || $(el).attr('aria-label') || '');
      const href = (($(el).attr('href') || '') as string).toString();
      const cls = (($(el).attr('class') || '') as string).toString();
      const id = (($(el).attr('id') || '') as string).toString();
      const data = `${t} ${href} ${cls} ${id}`.toLowerCase();
      return { t, href, data };
    })
    .get() as { t: string; href: string; data: string }[];

  const texts = uniq(items.map((x) => x.t)).slice(0, 200);
  const blob = items.map((x) => x.data).join(' ');
  return { items, texts, blob };
}

function computeScores($: any, url: string) {
  const html = $.html() || '';
  const text = $.text() || '';
  const textLower = text.toLowerCase();

  const hasHttps = url.startsWith('https://');
  const title = clean($('title').first().text());
  const meta = clean($('meta[name="description"]').attr('content') || '');
  const canonical = clean($('link[rel="canonical"]').attr('href') || '');
  const h1Count = $('h1').length;
  const h1 = clean($('h1').first().text());
  const headingsTotal = $('h1,h2,h3').length;

  const viewport = $('meta[name="viewport"]').length > 0;
  const og = $('meta[property="og:title"], meta[property="og:description"]').length > 0;

  const forms = $('form').length;
  const inputs = $('form input, form select, form textarea').length;
  const telLinks = $('a[href^="tel:"]').length;
  const mailtoLinks = $('a[href^="mailto:"]').length;

  const images = $('img').length;
  const videos = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;

  const lists = $('ul li, ol li').length;
  const sections = $('section').length;
  const accordionsLike = $('[aria-expanded], [aria-controls]').length;

  const { blob: ctaBlob, texts: ctaTexts } = gatherCtas($);

  // CTA keywords (EN + DE)
  const leadCtaRe =
    /\b(contact|kontakt|demo|request|anfragen|angebot|quote|termin|book|schedule|talk to|call|sales|get started|start now|beratung)\b/i;
  const contentCtaRe =
    /\b(download|whitepaper|ebook|guide|report|pdf|datasheet|webinar|case study|success story|studie|leitfaden|datenblatt)\b/i;
  const learnMoreRe = /\b(learn more|read more|mehr erfahren|discover|explore|details)\b/i;

  const hasLeadCta = leadCtaRe.test(ctaBlob);
  const hasContentCta = contentCtaRe.test(ctaBlob);
  const hasLearnMore = learnMoreRe.test(ctaBlob);

  // Above-the-fold CTA proxy
  const earlyHtml = html.slice(0, Math.min(html.length, 18000)).toLowerCase();
  const atfCta = leadCtaRe.test(earlyHtml) || contentCtaRe.test(earlyHtml) || learnMoreRe.test(earlyHtml);

  // Intent classification
  const intent =
    forms > 0 || telLinks + mailtoLinks > 0 || hasLeadCta
      ? 'lead_capture'
      : hasContentCta
      ? 'content_offer'
      : 'product_info';

  // Message match proxy: URL slug keywords appear in title/h1/early content
  const kws = slugKeywords(url);
  const matchHay = `${title} ${h1} ${textLower.slice(0, 1200)}`.toLowerCase();
  const keywordHits = kws.filter((k) => matchHay.includes(k)).length;
  const messageMatch = clamp(keywordHits * 12, 0, 60);

  // Hygiene (SEA: low weight)
  let technical = 0;
  if (hasHttps) technical += 20;
  if (title.length >= 8) technical += 18;
  if (meta.length >= 40) technical += 12;
  if (viewport) technical += 18;
  if (og) technical += 10;
  if (canonical) technical += 6;
  if (headingsTotal >= 4) technical += 16;
  technical = clamp(technical);

  // Structure / clarity
  const structureWords = [
    'how it works',
    'benefits',
    'features',
    'use cases',
    'solutions',
    'industries',
    'faq',
    'questions',
    'häufig',
    'vorteile',
    'funktionen',
    'anwendungs',
    'use case',
    'so funktioniert',
  ];
  let structure = 0;
  structure += clamp(Math.min(sections * 6, 30));
  structure += clamp(Math.min(lists * 1.2, 35));
  structure += clamp(Math.min(accordionsLike * 2, 20));
  structure += clamp(
    structureWords.reduce((acc, w) => (textLower.includes(w) ? acc + 6 : acc), 0),
    0,
    25
  );
  structure = clamp(structure);

  // Trust / proof
  const trustWords = [
    'testimonial',
    'case study',
    'success story',
    'reference',
    'referenz',
    'kundenstimme',
    'trusted by',
    'used by',
    'award',
    'gartner',
    'forrester',
    'g2',
    'capterra',
    'iso',
    'din',
    'cert',
    'zert',
    'compliance',
    'security',
    'privacy',
    'datenschutz',
    'cyber',
  ];
  const isoLike = /\biso\s*\d{4,5}\b/i.test(text);
  const quoteCount = $('blockquote').length + (text.match(/[“”"]/g) || []).length / 2;
  const numbers = (text.match(/\b\d{1,3}(?:[\.,]\d{1,3})?\b/g) || []).length;
  const proofNumbers = clamp(Math.min(numbers * 2.2, 30));

  let trust = 0;
  trust += clamp(trustWords.reduce((acc, w) => (textLower.includes(w) ? acc + 8 : acc), 0), 0, 55);
  trust += clamp(Math.min(quoteCount * 10, 25));
  if (isoLike) trust += 20;
  trust += proofNumbers;
  trust = clamp(trust);

  // Value prop
  const benefitWords = [
    'reduce',
    'increase',
    'improve',
    'save',
    'faster',
    'roi',
    'downtime',
    'efficiency',
    'quality',
    'predict',
    'prevent',
    'monitor',
    'alerts',
    'transparency',
    'kosten',
    'einsparen',
    'reduz',
    'steiger',
    'schnell',
    'vermeiden',
    'wartung',
    'ausfall',
  ];
  let valueProp = 0;
  valueProp += clamp(benefitWords.reduce((acc, w) => (textLower.includes(w) ? acc + 5 : acc), 0), 0, 55);
  valueProp += clamp(Math.min(numbers * 1.6, 25));
  valueProp = clamp(valueProp);

  const convincing = clamp(Math.round(0.6 * trust + 0.4 * valueProp));

  // Conversion readiness (SEA-first)
  const primaryCtas = ctaTexts.filter((t) => leadCtaRe.test(t) || contentCtaRe.test(t) || learnMoreRe.test(t));
  const primaryCount = uniq(primaryCtas).length;
  const hasAnyPrimary = primaryCount > 0;
  const repeatedPrimary = primaryCount >= 2;

  let formQuality = 0;
  if (forms > 0) {
    if (inputs > 0 && inputs <= 6) formQuality += 20;
    else if (inputs <= 10) formQuality += 12;
    else formQuality += 6;
  }

  let bofu = 0;
  if (hasAnyPrimary) bofu += 35;
  if (atfCta) bofu += 18;
  if (repeatedPrimary) bofu += 10;

  if (intent === 'lead_capture') {
    if (forms > 0) bofu += 20;
    if (telLinks + mailtoLinks > 0) bofu += 10;
    if (hasLeadCta) bofu += 12;
    bofu += formQuality;
  } else if (intent === 'content_offer') {
    if (hasContentCta) bofu += 22;
    bofu += clamp(Math.round(structure * 0.2), 0, 20);
    if (hasLeadCta) bofu += 6;
  } else {
    if (hasLeadCta) bofu += 15;
    if (hasLearnMore) bofu += 8;
    bofu += clamp(Math.round((structure + convincing) * 0.1), 0, 20);
    if (telLinks + mailtoLinks > 0) bofu += 6;
  }

  bofu += clamp(Math.min(images * 1.2, 10));
  bofu += clamp(Math.min(videos * 6, 12));
  bofu += clamp(messageMatch * 0.6, 0, 36);

  bofu = clamp(bofu);

  // Overall (SEA-first weights)
  const overall = clamp(Math.round(0.45 * bofu + 0.35 * convincing + 0.15 * structure + 0.05 * technical));

  const positives: string[] = [];
  const improvements: string[] = [];

  if (hasAnyPrimary) positives.push('Primary CTA detected (button/link)');
  else improvements.push('Add a clear primary CTA (demo/contact OR download/whitepaper)');

  if (atfCta) positives.push('CTA likely visible above the fold');
  else improvements.push('Place a primary CTA in the hero / above the fold');

  if (intent === 'content_offer') {
    if (hasContentCta) positives.push('Content-offer CTA detected (download/whitepaper/etc.)');
    else improvements.push('Add a clear content-offer CTA (download/whitepaper/etc.)');
  }

  if (trust >= 60) positives.push('Strong trust signals (proof, references, certification)');
  else if (trust < 35) improvements.push('Add trust signals (testimonials, references, certifications, proof points)');

  if (structure >= 60) positives.push('Good scannable structure (sections/bullets/FAQs)');
  else if (structure < 35) improvements.push('Improve scannability (H2 sections, bullets, FAQ/how-it-works)');

  if (messageMatch >= 36) positives.push('Good message match (headline/hero copy aligned to keyword/topic)');
  else improvements.push('Tighten message match (headline/hero copy aligned to keyword/topic)');

  if (title) positives.push('Title present');
  else improvements.push('Add a clear, keyworded <title>');

  if (viewport) positives.push('Mobile viewport meta present');
  else improvements.push('Add meta viewport for mobile rendering');

  if (meta) positives.push('Meta description present');
  // SEA: optional

  if (h1) positives.push('H1 present');
  else improvements.push('Add a descriptive first H1');
  if (h1Count > 1) positives.push('Multiple H1s detected (allowed)');

  return {
    intent,
    scores: {
      overall,
      bofu,
      convincing,
      technical,
      structure,
      trust,
      messageMatch,
    },
    positives,
    improvements,
    _title: title || null,
    _h1: h1 || null,
  };
}

async function run(target: string) {
  const res = await fetch(target, {
    headers: {
      'user-agent': 'LP-Checker/1.0 (+lp-checker-tool.vercel.app)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const out = computeScores($, target);
  return { ...out, ok: res.ok, status: res.status, url: target };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const target = (u.searchParams.get('url') || '').toString().trim();

  // Ping endpoint (used by the UI to display "scoring logic version")
  if (!target) {
    return Response.json({ ok: true, ping: 'up', scoringLogicVersion: scoringLogicVersion() }, { status: 200 });
  }

  const out = await run(target);

  // Keep existing v3 scoring engine payload for compatibility with the rest of the app
  const goal = u.searchParams.get('goal') || undefined;
  const fieldsParam = u.searchParams.get('fields');
  const fieldsNum = fieldsParam ? Number(fieldsParam) : undefined;
  const signals = {
    h1: out._h1 ?? undefined,
    pageTitle: out._title ?? undefined,
    httpStatusOk: out.ok,
    funnelGoal: goal as any,
    formFieldsCount: Number.isFinite(fieldsNum as number) ? (fieldsNum as number) : undefined,
  };
  const scoring = scoreLanding(signals);

  return Response.json(
    {
      ...out,
      scoring,
      scoringLogicVersion: scoringLogicVersion(),
    },
    { status: out.ok ? 200 : out.status || 500 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const target = (body?.url || '').toString().trim();
    if (!target) {
      return Response.json({ ok: false, error: 'Missing "url" in body' }, { status: 400 });
    }

    const out = await run(target);

    const signals = {
      h1: out._h1 ?? undefined,
      pageTitle: out._title ?? undefined,
      httpStatusOk: out.ok,
      formFieldsCount: (body.formFieldsCount ?? undefined) as number | undefined,
      funnelGoal: (body.funnelGoal ?? undefined) as string | undefined,
    };
    const scoring = scoreLanding(signals);

    return Response.json({ ...out, scoring, scoringLogicVersion: scoringLogicVersion() }, { status: 200 });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
