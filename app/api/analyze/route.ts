import * as cheerio from "cheerio";
export const runtime = "edge";

function clamp(n:number,min=0,max=100){return Math.max(min,Math.min(max,n));}
function pct(x:number){return clamp(Math.round(x));}

function scoreFromFlags(flags:Record<string,boolean>, weights:Record<string,number>){
  let total=0, wsum=0;
  for (const [k,w] of Object.entries(weights)){ wsum+=Math.abs(w); total += (flags[k]?1:0)*w*100; }
  if (!wsum) return 0;
  return clamp(total/wsum);
}

async function fetchHtml(url:string){
  const res = await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (LP-Checker/1.0)'},cache:'no-store'});
  if(!res.ok) throw new Error('Fetch failed: '+res.status);
  return await res.text();
}

function analyzeHtml(html:string, url:string){
  const lower = html.toLowerCase();

  const hasPrimaryCta = /<(?:button|a)[^>]*(cta|kontakt|contact|angebot|quote|kaufen|buy|demo|trial|jetzt|now)/.test(lower);
  const ctaCount = (lower.match(/<(?:button|a)[^>]+(cta|kontakt|contact|angebot|quote|kaufen|buy|demo|trial|jetzt|now)/g)||[]).length;
  const hasForm = /<form[\s>]/.test(lower) || /(input|select|textarea)/.test(lower);
  const contactRoute = /(tel:|mailto:|whatsapp\.com|\/kontakt|\/contact|\/anfrage|\/angebot|\/quote)/.test(lower);
  const pricing = /(preis|preise|kosten|pricing|price|quote)/.test(lower);

  const benefits = /(benefit|nutzen|why|why us|value|outcome)/.test(lower);
  const trust = /(testimonial|case|bewertung|review|rating|kundenlogo|client logo|trustpilot|gartner|award|certificate)/.test(lower);
  const objections = /(faq|question|garantie|warranty|refund|privacy|security|datenschutz|policy)/.test(lower);
  const visuals = /<img[\s>]/.test(lower) || /(video|youtube|mp4|webm)/.test(lower);

  const httpsOk = url.startsWith('https://');
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*>/.test(lower);
  const titleTag = /<title>[^<]{5,}<\/title>/.test(lower);
  const metaDesc = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']{20,}["']/.test(lower);
  const h1 = /<h1[\s>]/.test(lower);
  const mobile = /<meta[^>]+name=["']viewport["'][^>]*>/.test(lower);
  const hasImg = /<img[\s>]/.test(lower);
  const hasAlt = /<img[^>]+alt=/.test(lower);

  let technical = 40;
  if (httpsOk) technical += 14;
  if (titleTag) technical += 12;
  if (metaDesc) technical += 10;
  if (h1) technical += 8;
  if (mobile) technical += 8;
  if (canonical) technical += 6;
  if (hasImg && !hasAlt) technical -= 8;
  technical = clamp(technical);

  const bofuFlags = { primaryCta: hasPrimaryCta, multipleCtas: ctaCount>=2, leadPath: hasForm||contactRoute, explicitForm:hasForm, explicitContact:contactRoute, pricing };
  let bofu = scoreFromFlags(bofuFlags, { primaryCta:5, multipleCtas:1, leadPath:4, explicitForm:2, explicitContact:2, pricing:3 });
  if (!hasPrimaryCta) bofu = Math.min(bofu, 45);
  if (!hasForm && !contactRoute) bofu = Math.min(bofu, 55);
  if (!pricing) bofu = Math.min(bofu, 70);

  const convincingFlags = { benefits, trust, objections, visuals };
  let convincing = scoreFromFlags(convincingFlags, { benefits:3, trust:4, objections:3, visuals:2 });
  if (!trust) convincing = Math.min(convincing, 60);
  if (!benefits) convincing = Math.min(convincing, 65);
  if (!objections) convincing = Math.min(convincing, 65);

  let overall = clamp(bofu*0.5 + convincing*0.35 + technical*0.15);
  const pillarsPresent = [hasPrimaryCta, (hasForm||contactRoute), trust, benefits].filter(Boolean).length;
  const missing = 4 - pillarsPresent;
  if (missing >= 3) overall = Math.min(overall, 45);
  else if (missing == 2) overall = Math.min(overall, 65);
  else if (missing == 1) overall = Math.min(overall, 78);

  const positives:string[] = [];
  const improvements:string[] = [];
  if (hasPrimaryCta) positives.push('Primary CTA found.'); else improvements.push('Add one clear primary CTA above the fold.');
  if (hasForm) positives.push('Lead form present.');
  if (contactRoute) positives.push('Direct contact route available (tel/mail/WhatsApp).');
  if (!hasForm && !contactRoute) improvements.push('Provide a short form and/or an immediate contact route.');
  if (pricing) positives.push('Pricing/cost information detected.'); else improvements.push('Clarify pricing or provide an estimate/quote path.');
  if (trust) positives.push('Trust signals present (testimonials/cases/ratings).'); else improvements.push('Add social proof: testimonials, case studies, ratings, or client logos.');
  if (benefits) positives.push('Benefit-led messaging detected.'); else improvements.push('Strengthen benefits/outcomes over features.');
  if (objections) positives.push('Objection handling present (FAQs/guarantees/policies).'); else improvements.push('Address common objections (FAQ, guarantees, privacy/security).');
  if (visuals) positives.push('Meaningful visuals present (images/video).'); else improvements.push('Add product/service visuals or a short explainer video.');
  if (httpsOk) positives.push('HTTPS enabled.');
  if (!titleTag) improvements.push('Add a descriptive <title> tag.');
  if (!metaDesc) improvements.push('Provide a meaningful meta description.');
  if (!h1) improvements.push('Add a clear <h1> headline.');
  if (!mobile) improvements.push('Include a responsive <meta name="viewport"> tag.');
  if (!canonical) improvements.push('Add a canonical tag.');
  if (hasImg && !hasAlt) improvements.push('Provide alt text for key images.');

  const parts:string[] = [];
  parts.push(`BoFu: ${pct(bofu)}/100 — ` + [hasPrimaryCta ? 'clear CTA' : 'CTA missing', (hasForm || contactRoute) ? 'lead path present' : 'no lead path', pricing ? 'pricing visible' : 'pricing unclear'].join(', ') + '.');
  parts.push(`Convincing: ${pct(convincing)}/100 — ` + [benefits ? 'benefits present' : 'benefits weak', trust ? 'trust present' : 'no trust', objections ? 'objections handled' : 'no objections section', visuals ? 'visuals present' : 'no visuals'].join(', ') + '.');
  parts.push(`Technical (light): ${pct(technical)}/100.`);
  const summary = parts.join(' ');

  return { scores:{overall, bofu, convincing, technical}, positives, improvements, summary };
}

export async function GET(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (!url) return new Response(JSON.stringify({ error:'Missing url' }), { status:400 });
    const html = await fetchHtml(url);
    const result = analyzeHtml(html, url);
    return new Response(JSON.stringify(result), { headers:{'content-type':'application/json','access-control-allow-origin':'*'} });
  }catch(e:any){
    return new Response(JSON.stringify({ error:e.message||'Failed' }), { status:500, headers:{'content-type':'application/json','access-control-allow-origin':'*'} });
  }
}
