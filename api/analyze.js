export const config = { runtime: 'edge' };

/** Utils **/
function clamp(n, min=0, max=100){ return Math.max(min, Math.min(max, n)); }
function pct(x){ return clamp(Math.round(x)); }

function scoreFromFlags(flags, weights){
  let total = 0, wsum = 0;
  for (const [key, w] of Object.entries(weights)){
    wsum += Math.abs(w);
    total += (flags[key] ? 1 : 0) * w * 100;
  }
  if (wsum === 0) return 0;
  return clamp(total / wsum);
}

async function fetchHtml(url){
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (LP-Checker/1.0)' },
  });
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  const text = await res.text();
  return text;
}

function analyzeHtml(html, url){
  const lower = html.toLowerCase();

  // --- BOFU signals ---
  const ctaRegex = /<(?:button|a)[^>]*(?:cta|kontakt|angebot|kaufen|jetzt|termin|anfragen|download|offerte|angebot anfordern|kontakt aufnehmen)/;
  const hasPrimaryCta = ctaRegex.test(lower);
  const ctaCount = (lower.match(/<(?:button|a)[^>]+(?:cta|kontakt|angebot|kaufen|jetzt|termin|anfragen|download|offerte)/g)||[]).length;
  const hasForm = /<form[\s>]/.test(lower) || /(input|select|textarea)/.test(lower);
  const contactRoute = /(tel:|mailto:|whatsapp\.com|\/kontakt|\/contact|\/anfrage|\/angebot)/.test(lower);
  const pricing = /(preis|preise|kosten|pricing|price)/.test(lower);

  // --- Convincing signals ---
  const benefits = /(vorteil|benefit|mehrwert|warum|darum|so klappt|use case|nutzen)/.test(lower);
  const trust = /(kundenstimme|referen[sz]|case|bewertung|trustpilot|testimonial|auszeichnung|zertifikat|kundenlogo|review|rating)/.test(lower);
  const objections = /(faq|fragen und antwort|einwand|garantie|widerruf|datenschutz|security|sicherheit)/.test(lower);
  const visuals = /<img[\s>]/.test(lower) || /(video|youtube|mp4|webm)/.test(lower);

  // --- Technical basics (light) ---
  const httpsOk = url.startsWith('https://');
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*>/.test(lower);
  const titleTag = /<title>[^<]{5,}<\/title>/.test(lower);
  const metaDesc = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']{20,}["']/.test(lower);
  const h1 = /<h1[\s>]/.test(lower);
  const mobile = /<meta[^>]+name=["']viewport["'][^>]*>/.test(lower);
  const hasImg = /<img[\s>]/.test(lower);
  const hasAlt = /<img[^>]+alt=/.test(lower);

  // --- Technical score (stricter, light) ---
  let technical = 45;
  if (httpsOk) technical += 12;
  if (titleTag) technical += 10;
  if (metaDesc) technical += 8;
  if (h1) technical += 6;
  if (mobile) technical += 6;
  if (canonical) technical += 4;
  if (hasImg && !hasAlt) technical -= 6;
  technical = clamp(technical);

  // --- BoFu score (stricter caps) ---
  const bofuFlags = {
    primaryCta: hasPrimaryCta,
    multipleCtas: ctaCount >= 2,
    formOrLead: hasForm || contactRoute,
    explicitForm: hasForm,
    explicitContact: contactRoute,
    pricing
  };
  let bofu = scoreFromFlags(bofuFlags, {
    primaryCta: 4,
    multipleCtas: 1,
    formOrLead: 3,
    explicitForm: 2,
    explicitContact: 2,
    pricing: 2
  });
  if (!hasPrimaryCta) bofu = Math.min(bofu, 50);
  if (!hasForm && !contactRoute) bofu = Math.min(bofu, 55);
  if (!pricing) bofu = Math.min(bofu, 70);
  if (!(hasPrimaryCta && (hasForm || contactRoute))) bofu = Math.min(bofu, 80);

  // --- Convincing score (stricter caps) ---
  const convincingFlags = { benefits, trust, objections, visuals };
  let convincing = scoreFromFlags(convincingFlags, {
    benefits: 3,
    trust: 4,
    objections: 3,
    visuals: 2
  });
  if (!trust) convincing = Math.min(convincing, 60);
  if (!benefits) convincing = Math.min(convincing, 65);
  if (!objections) convincing = Math.min(convincing, 65);
  if (!(trust && benefits && visuals)) convincing = Math.min(convincing, 80);

  // --- Overall weighting ---
  let overall = clamp((bofu * 0.5) + (convincing * 0.35) + (technical * 0.15));

  // Overall caps; >=80 only if all four pillars + Technical ≥70
  const pillars = [ hasPrimaryCta, (hasForm || contactRoute), trust, benefits ];
  const present = pillars.filter(Boolean).length;
  const missing = 4 - present;
  if (missing >= 3) overall = Math.min(overall, 49);
  else if (missing === 2) overall = Math.min(overall, 68);
  else if (missing === 1) overall = Math.min(overall, 78);
  if (!(present === 4 && technical >= 70)) overall = Math.min(overall, 79);

  // --- Suggestions ---
  const positives = [];
  const improvements = [];

  if (hasPrimaryCta) positives.push('Primary CTA found.'); else improvements.push('Add a single, clear primary CTA above the fold.');
  if (hasForm) positives.push('Lead form present.');
  if (contactRoute) positives.push('Direct contact route available (tel/mail/WhatsApp).');
  if (!hasForm && !contactRoute) improvements.push('Provide a short form and/or an immediate contact route.');
  if (pricing) positives.push('Pricing/cost information detected.'); else improvements.push('Clarify pricing or provide a cost estimate path.');
  if (trust) positives.push('Trust signals present (testimonials/cases/ratings).'); else improvements.push('Add social proof: testimonials, case studies, ratings, or client logos.');
  if (benefits) positives.push('Benefit-led messaging detected.'); else improvements.push('Strengthen benefits (outcomes) over features.');
  if (objections) positives.push('Objection handling present (FAQs/guarantees/policies).'); else improvements.push('Address common objections (FAQ, guarantees, privacy/security).');
  if (visuals) positives.push('Helpful visuals present (images/video).'); else improvements.push('Add product/service visuals or a short explainer video.');
  if (httpsOk) positives.push('HTTPS enabled.');
  if (!titleTag) improvements.push('Add a descriptive <title> tag.');
  if (!metaDesc) improvements.push('Provide a meaningful meta description.');
  if (!h1) improvements.push('Add a clear <h1> headline.');
  if (!mobile) improvements.push('Include a responsive <meta name=\\\"viewport\\\"> tag.');
  if (!canonical) improvements.push('Add a canonical tag.');
  if (hasImg && !hasAlt) improvements.push('Provide alt text for key images.');

  // --- Narrative summary ---
  const parts = [];
  parts.push(`BoFu: ${pct(bofu)}/100 — ` + [
    hasPrimaryCta ? 'clear CTA' : 'CTA missing',
    (hasForm || contactRoute) ? 'lead path present' : 'no lead path',
    pricing ? 'pricing visible' : 'pricing unclear'
  ].join(', ') + '.');
  parts.push(`Convincing: ${pct(convincing)}/100 — ` + [
    benefits ? 'benefits present' : 'benefits weak',
    trust ? 'trust present' : 'no trust',
    objections ? 'objections handled' : 'no objections section',
    visuals ? 'visuals present' : 'no visuals'
  ].join(', ') + '.');
  parts.push(`Technical (light): ${pct(technical)}/100 — HTML basics only.`);
  const summary = parts.join(' ');

  return { scores: { overall, bofu, convincing, technical }, positives, improvements, summary };
}

export default async function handler(req){
  try{
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (!url) return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400 });

    const html = await fetchHtml(url);
    const result = analyzeHtml(html, url);

    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
    });
  }catch(e){
    return new Response(JSON.stringify({ error: e.message || 'Failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
    });
  }
}
