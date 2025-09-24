import * as cheerio from "cheerio";
export const runtime = "edge";

function clamp(n:number,min=0,max=100){return Math.max(min,Math.min(max,n));}
function pct(x:number){return clamp(Math.round(x));}

export async function GET(req: Request){
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url") || "";
  if(!/^https?:\/\//i.test(target)) return new Response(JSON.stringify({error:"Invalid URL"}),{status:400});

  // fetch HTML
  let html = "";
  try{
    const r = await fetch(target, {redirect:"follow"});
    if(!r.ok) return new Response(JSON.stringify({error:`Fetch failed: ${r.status}`}), {status:502});
    html = await r.text();
  }catch(e:any){
    return new Response(JSON.stringify({error:e?.message||"Fetch error"}),{status:500});
  }

  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g," ").toLowerCase();
  const title = ($("title").text()||"").trim();
  const metaDesc = $('meta[name="description"]').attr("content")||"";
  const h1 = $("h1").first().text()||"";
  const hasCanonical = $('link[rel="canonical"]').length>0;
  const hasPhone = /(tel:|\+\d{6,})/.test(html.toLowerCase());
  const hasEmail = /mailto:/.test(html.toLowerCase());
  const hasWhats = /whatsapp\.com/.test(html.toLowerCase());
  const hasForm = $("form").length>0 || /input|select|textarea/.test(html.toLowerCase());
  const ctas = ['buy','order','request','quote','demo','trial','contact','get started','pricing','subscribe','download','infopaket','brochure'];
  const ctaHits = ctas.filter(w=>text.includes(w)).length;
  const pricing = /(preis|preise|kosten|pricing|price|quote|angebot)/.test(text);
  const proofWords = ['case study','testimonial','review','kunden','customer','trusted by','zertifikat','iso','warranty','references','bewertungen','ratings','logos'];
  const proofHits = proofWords.filter(w=>text.includes(w)).length;
  const numbers = (text.match(/\b\d+%?/g)||[]).length;
  const faq = /(faq|fragen|garantie|widerruf|rücktritt|agb|policy)/.test(text);

  // Scoring (friendlier caps, Apple/Lifta-like landing pages score better)
  let bofu = 0;
  bofu += Math.min(50, ctaHits*10);         // CTA language
  bofu += hasForm ? 20 : 10;                // form visible or not
  bofu += (hasPhone?10:0) + (hasEmail?5:0) + (hasWhats?5:0);
  bofu += pricing ? 10 : 0;
  bofu = clamp(bofu, 0, 100);

  let convincing = 0;
  convincing += Math.min(40, proofHits*10);
  convincing += Math.min(30, Math.floor(numbers/8)*10);
  convincing += faq ? 10 : 0;
  convincing += h1 && h1.length<=90 ? 10 : 0;
  convincing = clamp(convincing, 0, 100);

  let technical = 0;
  technical += title && title.length>=20 && title.length<=70 ? 15 : title ? 8 : 0;
  technical += metaDesc && metaDesc.length>=50 && metaDesc.length<=160 ? 15 : metaDesc ? 8 : 0;
  technical += h1 ? 10 : 0;
  technical += hasCanonical ? 10 : 0;
  technical += html.toLowerCase().includes("https") ? 10 : 0;
  technical += text.length>1500 ? 10 : 0;
  technical = clamp(technical, 0, 100);

  // Weights
  const overall = pct(0.5*bofu + 0.35*convincing + 0.15*technical);

  // Highlights and improvements
  const positives:string[] = [];
  if (bofu>=50) positives.push("Primary CTAs and lead path detected.");
  if (pricing) positives.push("Pricing or quote information present.");
  if (proofHits>=1) positives.push("Trust signals present (logos/testimonials/cases/ratings).");
  if (faq) positives.push("Objection handling detected (FAQs/guarantees/policies).");
  if (numbers>10) positives.push("Outcome-focused messaging (numbers/percentages).");
  if (technical>=60) positives.push("Solid technical basics in place.");

  const improvements:string[] = [];
  if (ctaHits<1) improvements.push("Add a clear primary BoFu CTA above the fold (e.g., “Request information package”).");
  if (!hasForm) improvements.push("Expose a simple form or make the contact action frictionless (phone/WhatsApp/email).");
  if (!pricing) improvements.push("Make pricing/quote path explicit or add a pricing range.");
  if (proofHits<2) improvements.push("Strengthen proof: recognizable customer logos, case studies with outcomes, ratings.");
  if (!faq) improvements.push("Add objection handling (FAQ, guarantee/return/policy section).");
  if (!hasCanonical) improvements.push("Add canonical tag to avoid duplicate signals.");
  if (!metaDesc) improvements.push("Add a meta description (50–160 chars) with benefit + CTA.");
  if (!h1) improvements.push("Add a single descriptive H1 matching the offer.");

  const mgmt = `Overall ${overall}/100 (BoFu ${pct(bofu)}, Convincing ${pct(convincing)}, Technical ${pct(technical)}). ` +
    `Focus on reinforcing proof (case studies/ratings) and keeping one dominant CTA with a clear lead path.`;

  return new Response(JSON.stringify({
    scores: { overall: pct(overall), bofu: pct(bofu), convincing: pct(convincing), technical: pct(technical) },
    positives,
    improvements,
    mgmt
  }), {headers:{'content-type':'application/json'}});
}
