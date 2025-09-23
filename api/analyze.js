export const config = { runtime: 'edge' };

// --- helpers
const clamp = (n, min=0, max=100) => Math.max(min, Math.min(max, n));
const pct = (x) => clamp(Math.round(x));
function scoreFromFlags(flags, weights){
  let total = 0, wsum = 0;
  for (const [k,w] of Object.entries(weights)){
    wsum += Math.abs(w);
    total += (flags[k] ? 1 : 0) * w * 100;
  }
  return wsum ? clamp(total / wsum) : 0;
}

async function fetchHtml(url){
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (LP-Checker/1.0)' },
  });
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  return await res.text();
}

function analyzeHtml(html, url){
  const s = html.toLowerCase();

  // --- BOFU
  const primaryCta = /<(?:button|a)[^>]*(cta|kontakt|angebot|kaufen|jetzt|termin|anfragen|download)/.test(s);
  const hasForm = /<form[\s>]/.test(s) || /(input|select|textarea)/.test(s);
  const contact = /(tel:|mailto:|whatsapp\.com|\/(kontakt|contact|anfrage|angebot))/.test(s);
  const pricing = /(preis|preise|kosten|pricing|price)/.test(s);

  // --- Convincing
  const benefits = /(vorteil|benefit|mehrwert|nutzen)/.test(s);
  const trust = /(testimonial|bewertung|referen[sz]|rating|review|kundenlogo|case study|trustpilot)/.test(s);
  const objections = /(faq|garantie|widerruf|datenschutz|sicherheit)/.test(s);
  const visuals = /<img|video|youtube|mp4|webm/.test(s);

  // --- Technical (light)
  const httpsOk = url.startsWith('https://');
  const titleOk = /<title>[^<]{5,}<\/title>/.test(s);
  const metaOk = /<meta[^>]+name=["']description["'][^>]*content=/.test(s);
  const h1Ok = /<h1[\s>]/.test(s);
  const viewportOk = /<meta[^>]+name=["']viewport["']/.test(s);

  let technical = 40;
  if (httpsOk) technical += 15;
  if (titleOk) technical += 15;
  if (metaOk) technical += 10;
  if (h1Ok) technical += 10;
  if (viewportOk) technical += 10;
  technical = clamp(technical);

  const bofu = scoreFromFlags(
    { primaryCta, hasForm, contact, pricing },
    { primaryCta: 4, hasForm: 3, contact: 3, pricing: 2 }
  );

  const convincing = scoreFromFlags(
    { benefits, trust, objections, visuals },
    { benefits: 3, trust: 4, objections: 3, visuals: 2 }
  );

  let overall = clamp((bofu * 0.5) + (convincing * 0.35) + (technical * 0.15));

  const positives = [];
  const improvements = [];
  primaryCta ? positives.push('Primary CTA found.') : improvements.push('Add a clear primary CTA.');
  (hasForm || contact) ? positives.push('Lead path present (form/contact).') : improvements.push('Add a form or direct contact option.');
  pricing ? positives.push('Pricing info visible.') : improvements.push('Show pricing or cost guidance.');
  trust ? positives.push('Trust signals present.') : improvements.push('Add testimonials/ratings/case studies.');
  benefits ? positives.push('Benefit-led copy present.') : improvements.push('Strengthen benefit-led messaging.');
  objections ? positives.push('Objection handling present.') : improvements.push('Add FAQ/guarantees/policies.');
  visuals ? positives.push('Helpful visuals present.') : improvements.push('Add images/video.');

  if (httpsOk) positives.push('HTTPS enabled.');
  if (!titleOk) improvements.push('Add a descriptive <title> tag.');
  if (!metaOk) improvements.push('Provide a meaningful meta description.');
  if (!h1Ok) improvements.push('Add a clear <h1> headline.');
  if (!viewportOk) improvements.push('Include <meta name="viewport"> for mobile.');

  const summary = `BoFu: ${pct(bofu)}/100 — ${primaryCta ? 'CTA ok' : 'CTA missing'}, ${hasForm||contact ? 'lead path present' : 'no lead path'}, ${pricing ? 'pricing visible' : 'pricing unclear'}. ` +
                  `Convincing: ${pct(convincing)}/100 — ${benefits?'benefits':''}${benefits?'':'no benefits'}, ${trust?'trust':''}${trust?'':'no trust'}. ` +
                  `Technical (light): ${pct(technical)}/100.`;

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
