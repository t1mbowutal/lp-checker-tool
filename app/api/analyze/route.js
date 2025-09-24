import { NextResponse } from 'next/server';
import { parse } from 'node-html-parser';
import fetch from 'cross-fetch';

// Excel-like weighted scoring configuration
const WEIGHTS = {
  bofu: 0.35,       // Purchase / CTA strength
  convincing: 0.35, // Proof, trust, specificity
  technical: 0.30   // Meta, structure, canonical, hreflang, etc.
};

function pct(x){ return Math.max(0, Math.min(100, Math.round(x))); }

export async function POST(req) {
  try {
    const body = await req.json();
    const { url } = body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Invalid or missing URL' }, { status: 400 });
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 502 });
    }
    const html = await res.text();
    const root = parse(html);

    const text = root.text.replace(/\s+/g,' ').toLowerCase();
    const title = root.querySelector('title')?.text || '';
    const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const h1 = root.querySelector('h1')?.text || '';
    const h2s = root.querySelectorAll('h2').map(n=>n.text);
    const hasCanonical = !!root.querySelector('link[rel="canonical"]');
    const hasNoindex = !!root.querySelector('meta[content*="noindex"]');
    const hasHreflang = !!root.querySelector('link[rel="alternate"][hreflang]');

    // Heuristics for BoFu (CTA strength, forms, offer)
    const ctaWords = ['buy','order','request','quote','demo','trial','contact','get started','add to cart','enquire','book','pricing','subscribe','download'];
    const offerWords = ['price','free','trial','quote','discount','offer'];
    const formSignals = root.querySelectorAll('form,input[type="email"],input[type="tel"],input[type="text"],button, a[href*="contact"], a[href*="/demo"], a[href*="/quote"]').length;

    let bofu = 0;
    const ctaHits = ctaWords.filter(w=>text.includes(w)).length;
    bofu += Math.min(60, ctaHits * 12);           // up to 60 from CTA language
    bofu += Math.min(25, formSignals * 5);        // up to 25 from presence of forms/buttons
    bofu += title.toLowerCase().includes('demo') || title.toLowerCase().includes('quote') ? 10 : 0;
    bofu = Math.min(100, bofu);

    // Convincing (proof, specificity, social proof)
    const proofWords = ['case study','testimonial','customer','roi','reduce','increase','save','success story','review','trusted by','partner','iso','certificate','warranty'];
    const numbers = (text.match(/\b\d+%?/g) || []).length;
    const proofHits = proofWords.filter(w=>text.includes(w)).length;
    let convincing = 0;
    convincing += Math.min(40, proofHits * 10);   // up to 40
    convincing += Math.min(30, Math.floor(numbers/10) * 10); // numeric specificity
    convincing += h2s.length >= 3 ? 15 : 0;
    convincing += h1 && h1.length <= 80 ? 10 : 0;
    convincing = Math.min(100, convincing);

    // Technical (meta, headings, canonical, indexability, basic length)
    let technical = 0;
    technical += title && title.length >= 20 && title.length <= 70 ? 20 : (title ? 10 : 0);
    technical += metaDesc && metaDesc.length >= 50 && metaDesc.length <= 160 ? 20 : (metaDesc ? 10 : 0);
    technical += h1 ? 15 : 0;
    technical += hasCanonical ? 15 : 0;
    technical += hasHreflang ? 10 : 0;
    technical += !hasNoindex ? 10 : 0;
    technical += text.length > 2000 ? 10 : 0;
    technical = Math.min(100, technical);

    const overall = pct(WEIGHTS.bofu * bofu + WEIGHTS.convincing * convincing + WEIGHTS.technical * technical);

    // Highlights & improvements (Excel-like: if below thresholds, add items)
    const highlights = [];
    if (bofu >= 67) highlights.push('Strong BoFu signals and CTAs present.');
    if (convincing >= 67) highlights.push('Clear proof points & numeric specificity.');
    if (technical >= 67) highlights.push('Solid technical basics (meta/canonical/hreflang).');
    if (highlights.length === 0) highlights.push('Found core page elements; see Improvements for gaps.');

    const improvements = [];
    if (ctaHits === 0) improvements.push('Add a primary BoFu CTA (e.g., “Request Demo” or “Get a Quote”).');
    if (formSignals < 2) improvements.push('Expose a visible form or button above the fold and repeat CTA down-page.');
    if (proofHits < 1) improvements.push('Add social proof (logos, testimonials, case studies) with quantifiable outcomes.');
    if (!title || title.length < 20 || title.length > 70) improvements.push('Rewrite the page title to 20–70 chars with a BoFu intent keyword.');
    if (!metaDesc || metaDesc.length < 50 || metaDesc.length > 160) improvements.push('Add/adjust meta description to 50–160 chars with benefit + CTA.');
    if (!hasCanonical) improvements.push('Add a canonical tag to prevent duplicate signals.');
    if (!h1) improvements.push('Add a single clear H1 matching the offer.');
    if (text.length < 1200) improvements.push('Increase content depth with scannable sections and specific outcomes.');

    return NextResponse.json({
      scores: { overall, bofu: pct(bofu), convincing: pct(convincing), technical: pct(technical) },
      highlights,
      improvements
    });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Fetch timeout (12s). The target may block server requests.' : (e.message || 'Error');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}