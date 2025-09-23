export const config = { runtime: 'edge' };

function clamp(n, min=0, max=100){ return Math.max(min, Math.min(max, n)); }

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

  // Core BOFU signals
  const hasPrimaryCta = /(button|a)[^>]*(?:cta|kontakt|angebot|kaufen|jetzt|termin|anfragen|download)/.test(lower);
  const ctaCount = (lower.match(/<(?:button|a)[^>]+(?:cta|kontakt|angebot|kaufen|jetzt|termin|anfragen|download)/g)||[]).length;
  const hasForm = /<form[\s>]/.test(lower) || /(input|select|textarea)/.test(lower);
  const contactRoute = /(tel:|mailto:|whatsapp\.com|\/kontakt|\/contact)/.test(lower);
  const trust = /(kundenstimme|referen[sz]|case|bewertung|trustpilot|testimonial|auszeichnung|zertifikat)/.test(lower);
  const pricing = /(preis|preise|kosten)/.test(lower);

  // Convincing signals (benefits, objections, visuals)
  const benefits = /(vorteil|benefit|mehrwert|warum|darum|so klappt)/.test(lower);
  const objections = /(faq|fragen und antwort|einwand|garantie|datenschutz|widerruf)/.test(lower);
  const visuals = /<img[\s>]/.test(lower) || /(video|youtube|mp4)/.test(lower);

  // Technical basics — light check only
  const httpsOk = url.startsWith('https://');
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*>/.test(lower);
  const titleTag = /<title>[^<]{5,}<\/title>/.test(lower);
  const metaDesc = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']{20,}["']/.test(lower);
  const h1 = /<h1[\s>]/.test(lower);
  const mobile = /<meta[^>]+name=["']viewport["'][^>]*>/.test(lower);
  const hasImg = /<img[\s>]/.test(lower);
  const hasAlt = /<img[^>]+alt=/.test(lower);

  // Technical score: neutral baseline 60 + increments
  let technical = 60;
  if (httpsOk) technical += 10;
  if (canonical) technical += 5;
  if (titleTag) technical += 10;
  if (metaDesc) technical += 5;
  if (h1) technical += 5;
  if (mobile) technical += 5;
  if (hasImg && !hasAlt) technical -= 5;
  technical = clamp(technical);

  // BOFU and Convincing scores
  const bofu = scoreFromFlags(
    { primaryCta: hasPrimaryCta, multipleCtas: ctaCount >= 2, formOrLead: hasForm, contactRoute, pricing },
    { primaryCta: 3, multipleCtas: 1, formOrLead: 3, contactRoute: 2, pricing: 1 }
  );

  const convincing = scoreFromFlags(
    { benefits, trust, objections, visuals },
    { benefits: 2, trust: 3, objections: 2, visuals: 1 }
  );

  // Overall weighting — technical has low influence
  const overall = clamp((bofu * 0.45) + (convincing * 0.40) + (technical * 0.15));

  // Suggestions
  const positives = [];
  const improvements = [];
  if (hasPrimaryCta) positives.push('Primary CTA found.');
  else improvements.push('Add a clear primary CTA (above the fold).');

  if (hasForm) positives.push('Lead form / input elements present.');
  else improvements.push('Consider a short lead form or clear contact route.');

  if (contactRoute) positives.push('Phone/email/whatsapp contact route present.');
  else improvements.push('Expose at least one direct contact route.');

  if (trust) positives.push('Trust/social proof present.');
  else improvements.push('Add proof: testimonials, case studies, ratings, or logos.');

  if (benefits) positives.push('Benefit-oriented copy detected.');
  else improvements.push('Strengthen benefits, not just features.');

  if (objections) positives.push('Objection handling present (FAQ/guarantees).');
  else improvements.push('Add objection handling (FAQ, guarantees, data privacy hints).');

  if (visuals) positives.push('Product/service visuals present.');
  else improvements.push('Add imagery or short video to increase clarity.');

  if (httpsOk) positives.push('HTTPS in place.');
  if (!canonical) improvements.push('Add a canonical tag.');
  if (!titleTag) improvements.push('Add a descriptive <title> tag.');
  if (!metaDesc) improvements.push('Add a meaningful meta description.');
  if (!h1) improvements.push('Add a clear <h1> headline.');
  if (!mobile) improvements.push('Add a responsive <meta name="viewport"> tag.');
  if (hasImg && !hasAlt) improvements.push('Provide alt text for key images.');

  return {
    scores: { overall, bofu, convincing, technical },
    positives, improvements
  };
}

export default async function handler(req){
  try{
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (!url) return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400 });
    const html = await fetchHtml(url);
    const result = analyzeHtml(html, url);
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }catch(e){
    return new Response(JSON.stringify({ error: e.message || 'Failed' }), { status: 500, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
}
