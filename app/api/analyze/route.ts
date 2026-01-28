import * as cheerio from "cheerio";
import { scoreLanding } from "../../../src/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}
function clean(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => clean(x)).filter(Boolean)));
}

function textScore(haystack: string, needles: string[], hit = 10, max = 100) {
  const l = (haystack || "").toLowerCase();
  let s = 0;
  for (const n of needles) {
    if (!n) continue;
    if (l.includes(n.toLowerCase())) s += hit;
  }
  return clamp(s, 0, max);
}

function slugKeywords(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const raw = last
      .replace(/\.html?$/i, "")
      .split(/[-_]/g)
      .map((x) => x.toLowerCase())
      .filter((x) => x.length >= 3);

    const stop = new Set([
      "and",
      "the",
      "with",
      "your",
      "for",
      "from",
      "into",
      "bring",
      "you",
      "de",
      "en",
      "us",
      "eu",
      "page",
      "landing",
      "lp",
      "in",
      "to",
      "of",
      "der",
      "die",
      "das",
      "und",
      "mit",
      "für",
      "aus",
      "zum",
      "zur",
      "ein",
      "eine",
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
      const t = clean($(el).text() || $(el).attr("value") || $(el).attr("aria-label") || "");
      const href = (($(el).attr("href") || "") as string).toString();
      const cls = (($(el).attr("class") || "") as string).toString();
      const id = (($(el).attr("id") || "") as string).toString();
      const data = `${t} ${href} ${cls} ${id}`.toLowerCase();
      return { t, href, data };
    })
    .get() as { t: string; href: string; data: string }[];

  // Don’t over-filter: corporate pages have lots of links; we only *detect* primaries by keywords.
  const texts = uniq(items.map((x) => x.t)).slice(0, 200);
  const blob = items.map((x) => x.data).join(" ");
  return { items, texts, blob };
}

function computeScores($: any, url: string) {
  const html = $.html() || "";
  const text = $.text() || "";
  const textLower = text.toLowerCase();

  const hasHttps = url.startsWith("https://");
  const title = clean($("title").first().text());
  const meta = clean($('meta[name="description"]').attr("content") || "");
  const canonical = clean($('link[rel="canonical"]').attr("href") || "");
  const h1Count = $("h1").length;
  const h1 = clean($("h1").first().text());
  const headingsTotal = $("h1,h2,h3").length;

  const viewport = $('meta[name="viewport"]').length > 0;
  const og = $('meta[property="og:title"], meta[property="og:description"]').length > 0;

  const forms = $("form").length;
  const inputs = $("form input, form select, form textarea").length;
  const telLinks = $('a[href^="tel:"]').length;
  const mailtoLinks = $('a[href^="mailto:"]').length;

  const images = $("img").length;
  const videos = $("video, iframe[src*='youtube'], iframe[src*='vimeo']").length;

  const lists = $("ul li, ol li").length;
  const sections = $("section").length;
  const accordionsLike = $("[aria-expanded], [aria-controls]").length;

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

  // Above-the-fold CTA proxy (scan early HTML; better than text slicing for component-heavy pages)
  const earlyHtml = html.slice(0, Math.min(html.length, 18000)).toLowerCase();
  const atfCta = leadCtaRe.test(earlyHtml) || contentCtaRe.test(earlyHtml) || learnMoreRe.test(earlyHtml);

  // Intent classification (SEA-friendly)
  const intent =
    forms > 0 || telLinks + mailtoLinks > 0 || hasLeadCta
      ? "lead_capture"
      : hasContentCta
      ? "content_offer"
      : "product_info";

  // Message match proxy: URL slug keywords appear in title/h1/early content
  const kws = slugKeywords(url);
  const matchHay = `${title} ${h1} ${textLower.slice(0, 1200)}`.toLowerCase();
  const keywordHits = kws.filter((k) => matchHay.includes(k)).length;
  const messageMatch = clamp(keywordHits * 12, 0, 60); // up to 60

  // --- Hygiene (SEA: low weight, but not ignored)
  let hygiene = 0;
  if (hasHttps) hygiene += 20;
  if (title.length >= 8) hygiene += 18;
  if (meta.length >= 40) hygiene += 12;
  if (viewport) hygiene += 18;
  if (og) hygiene += 10;
  // canonical is nice-to-have, not critical for SEA LP
  if (canonical) hygiene += 6;
  // allow multi-H1, just ensure structure exists
  if (headingsTotal >= 4) hygiene += 16;
  hygiene = clamp(hygiene);

  // --- Structure / Clarity (strong LPs are scannable)
  const structureWords = [
    "how it works",
    "benefits",
    "features",
    "use cases",
    "solutions",
    "industries",
    "faq",
    "questions",
    "häufig",
    "vorteile",
    "funktionen",
    "anwendungs",
    "use case",
    "so funktioniert",
  ];
  let structure = 0;
  structure += clamp(Math.min(sections * 6, 30));
  structure += clamp(Math.min(lists * 1.2, 35));
  structure += clamp(Math.min(accordionsLike * 2, 20));
  structure += textScore(text, structureWords, 6, 25);
  structure = clamp(structure);

  // --- Trust / Proof (strong LPs lean on proof + credibility)
  const trustWords = [
    "testimonial",
    "case study",
    "success story",
    "reference",
    "referenz",
    "kundenstimme",
    "trusted by",
    "used by",
    "award",
    "gartner",
    "forrester",
    "g2",
    "capterra",
    "iso",
    "din",
    "cert",
    "zert",
    "compliance",
    "security",
    "privacy",
    "datenschutz",
    "cyber",
  ];
  const isoLike = /\biso\s*\d{4,5}\b/i.test(text);
  const quoteCount =
    $("blockquote").length +
    (text.match(/[“”"]/g) || []).length / 2 +
    (text.match(/\b(said|sagt|meint)\b/i) ? 1 : 0);

  const numbers = (text.match(/\b\d{1,3}(?:[.,]\d{1,3})?\b/g) || []).length;
  const proofNumbers = clamp(Math.min(numbers * 2.2, 30));

  let trust = 0;
  trust += textScore(text, trustWords, 8, 55);
  trust += clamp(Math.min(quoteCount * 10, 25));
  if (isoLike) trust += 20;
  trust += proofNumbers;
  trust = clamp(trust);

  // --- Value prop (benefit language + outcome orientation)
  const benefitWords = [
    "reduce",
    "increase",
    "improve",
    "save",
    "faster",
    "minutes",
    "hours",
    "roi",
    "downtime",
    "efficiency",
    "quality",
    "predict",
    "prevent",
    "monitor",
    "alerts",
    "transparency",
    "kosten",
    "einsparen",
    "reduz",
    "steiger",
    "schnell",
    "vermeiden",
    "wartung",
    "ausfall",
  ];
  let valueProp = 0;
  valueProp += textScore(text, benefitWords, 5, 55);
  valueProp += clamp(Math.min(numbers * 1.6, 25));
  valueProp = clamp(valueProp);

  const convincing = clamp(Math.round(0.60 * trust + 0.40 * valueProp));

  // --- Conversion readiness (SEA-first: clear next step beats “must have form”)
  const primaryCtas = ctaTexts.filter((t) => leadCtaRe.test(t) || contentCtaRe.test(t) || learnMoreRe.test(t));
  const primaryCount = uniq(primaryCtas).length;

  const hasAnyPrimary = primaryCount > 0;
  const repeatedPrimary = primaryCount >= 2;

  // Light form friction heuristic (reward short forms, don’t kill long ones too hard)
  let formQuality = 0;
  if (forms > 0) {
    if (inputs > 0 && inputs <= 6) formQuality += 20;
    else if (inputs <= 10) formQuality += 12;
    else formQuality += 6;
  }

  let conversion = 0;

  // universal conversion building blocks
  if (hasAnyPrimary) conversion += 35;
  if (atfCta) conversion += 18;
  if (repeatedPrimary) conversion += 10;

  // intent specific
  if (intent === "lead_capture") {
    if (forms > 0) conversion += 20;
    if (telLinks + mailtoLinks > 0) conversion += 10;
    if (hasLeadCta) conversion += 12;
    conversion += formQuality;
  } else if (intent === "content_offer") {
    if (hasContentCta) conversion += 22;
    // content offers often include more info; reward structure as “conversion support”
    conversion += clamp(Math.round(structure * 0.20), 0, 20);
    // optional lead CTA is a plus
    if (hasLeadCta) conversion += 6;
  } else {
    // product/info
    if (hasLeadCta) conversion += 15;
    if (hasLearnMore) conversion += 8;
    // reward depth: product pages convert via understanding + proof
    conversion += clamp(Math.round((structure + convincing) * 0.10), 0, 20);
    if (telLinks + mailtoLinks > 0) conversion += 6;
  }

  // visual support (common in strong LPs)
  conversion += clamp(Math.min(images * 1.2, 10));
  conversion += clamp(Math.min(videos * 6, 12));

  // message match is a *big* SEA lever
  conversion += clamp(messageMatch * 0.6, 0, 36);

  conversion = clamp(conversion);

  // --- Overall (SEA-first weights)
  const overall = clamp(
    Math.round(
      0.45 * conversion + //
        0.35 * convincing +
        0.15 * structure +
        0.05 * hygiene
    )
  );

  // Human-readable feedback
  const positives: string[] = [];
  const improvements: string[] = [];

  if (hasAnyPrimary) positives.push("Primary CTA detected (button/link)");
  else improvements.push("Add a clear primary CTA (e.g., demo/contact OR download/whitepaper)");

  if (atfCta) positives.push("CTA likely visible above the fold");
  else improvements.push("Place a primary CTA in the hero / above the fold");

  if (intent === "lead_capture") {
    if (forms > 0 || telLinks + mailtoLinks > 0) positives.push("Clear lead capture path available");
    else improvements.push("Add a lead capture option (form, call, or email)");
  }
  if (intent === "content_offer") {
    if (hasContentCta) positives.push("Content-offer CTA detected (download/whitepaper/etc.)");
    else improvements.push("Add a clear content-offer CTA (download/whitepaper/etc.)");
  }

  if (trust >= 60) positives.push("Strong trust signals (proof, references, certification)");
  else if (trust < 35) improvements.push("Add trust signals (testimonials, references, certifications, proof points)");

  if (structure >= 60) positives.push("Good scannable structure (sections/bullets/FAQs)");
  else if (structure < 35) improvements.push("Improve scannability (H2 sections, bullets, FAQ/how-it-works)");

  if (messageMatch >= 36) positives.push("Good message match (URL/topic reflected in headline/content)");
  else improvements.push("Tighten message match (headline/hero copy aligned to keyword/topic)");

  if (title) positives.push("Title present");
  else improvements.push('Add a clear, keyworded <title>');

  if (viewport) positives.push("Mobile viewport meta present");
  else improvements.push("Add meta viewport for mobile rendering");

  if (meta) positives.push("Meta description present");
  // not critical for SEA; don’t push as “must”
  else improvements.push("Optional: add meta description (nice-to-have)");

  if (h1) positives.push("H1 present");
  else improvements.push("Add a descriptive first H1");

  if (h1Count > 1) positives.push("Multiple H1s detected (allowed)");

  return {
    intent,
    scores: {
      overall,
      bofu: conversion, // keep field name for compatibility
      convincing,
      technical: hygiene, // keep field name for compatibility
      structure,
      messageMatch,
      trust,
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
      "user-agent": "LP-Checker/1.0 (+lp-checker-tool.vercel.app)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const out = computeScores($, target);
  return { ...out, ok: res.ok, status: res.status, url: target };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const target = (u.searchParams.get("url") || "").toString().trim();
  if (!target) {
    return Response.json({ ok: true, ping: "up" }, { status: 200 });
  }

  const out = await run(target);

  // Keep existing scoring payload (even if your src/lib/scoring.ts is used elsewhere)
  const goal = u.searchParams.get("goal") || undefined;
  const fieldsParam = u.searchParams.get("fields");
  const fieldsNum = fieldsParam ? Number(fieldsParam) : undefined;

  const signals = {
    h1: out._h1 ?? undefined,
    pageTitle: out._title ?? undefined,
    httpStatusOk: out.ok,
    funnelGoal: goal as any,
    formFieldsCount: Number.isFinite(fieldsNum as number) ? (fieldsNum as number) : undefined,
  };

  const scoring = scoreLanding(signals);

  return Response.json({ ...out, scoring }, { status: out.ok ? 200 : out.status || 500 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const target = (body?.url || "").toString().trim();
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

    return Response.json({ ...out, scoring }, { status: 200 });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
