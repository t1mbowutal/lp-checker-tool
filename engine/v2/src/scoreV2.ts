diff --git a/app/api/analyze/route.ts b/app/api/analyze/route.ts
index 7c13f1feeec16a5edfb5cb71a2476f718f2b2457..a0577c32ad3a7a24bcd58a98235a0d9c5d2977fd 100644
--- a/app/api/analyze/route.ts
+++ b/app/api/analyze/route.ts
@@ -1,138 +1,50 @@
 import * as cheerio from "cheerio";
+import type { ScoreEngine } from "../../../engine/types";
+import { score as scoreV1 } from "../../../engine/v1";
+import { score as scoreV2 } from "../../../engine/v2";
 
 export const runtime = 'nodejs';
 export const dynamic = 'force-dynamic';
 
-function clamp(n:number, min=0, max=100){ return Math.max(min, Math.min(max, Math.round(n))); }
-function pct(part:number, total:number){ return total>0 ? clamp((part/total)*100) : 0; }
-
-function textScore(text:string, needles:string[], perHit=25, max=100){
-  let score = 0;
-  const lower = text.toLowerCase();
-  for(const n of needles){
-    if(lower.includes(n)) score += perHit;
-  }
-  return clamp(score,0,max);
-}
-
-function computeScores($: any, url: string){
-  const html = $.html() || "";
-  const text = $.text() || "";
-  const hasHttps = url.startsWith("https://");
-  const title = $("title").first().text();
-  const meta = $('meta[name="description"]').attr("content") || "";
-  const h1 = $("h1").first().text();
-  const canonical = $('link[rel="canonical"]').attr("href") || "";
-  const forms = $("form").length;
-  const telLinks = $('a[href^="tel:"]').length;
-  const mailtoLinks = $('a[href^="mailto:"]').length;
-  const buttons = $("button, a.button, a.btn").map((_:any,el:any)=>$(el).text()).get().join(" ").toLowerCase();
-  const priceLike = /\b(€|eur|usd|\$|price|pricing|angebot|kosten|prei|quote)\b/i.test(text);
-  const ctaHit = /\b(contact|quote|angebot|anfragen|request|buy|kaufen|kontakt|whatsapp|call|offer|get started|get a quote)\b/i.test(buttons + " " + text);
-
-  // Technical (title, meta, h1, canonical, https)
-  let technical = 0;
-  if (hasHttps) technical += 20;
-  if (title && title.length > 0) technical += 20;
-  if (meta && meta.length > 0) technical += 20;
-  if (h1 && h1.length > 0) technical += 20;
-  if (canonical && canonical.length > 0) technical += 20;
-  technical = clamp(technical);
-
-  // BoFu (forms, tel/mailto, CTA language, pricing)
-  let bofu = 0;
-  if (forms > 0) bofu += 40;
-  if (telLinks + mailtoLinks > 0) bofu += 20;
-  if (ctaHit) bofu += 25;
-  if (priceLike) bofu += 15;
-  bofu = clamp(bofu);
-
-  // Convincing (trust signals & outcomes)
-  const trustWords = ["testimonial","case study","review","rating","stars","kund","garantie","warranty","iso","din","cert","zert","success story","reference","referenz"];
-  let convincing = 0;
-  convincing += textScore(text, trustWords, 12, 60); // up to 60 via mentions
-  const numbers = (text.match(/\b\d{1,3}(?:[\.,]\d{1,3})?\b/g) || []).length;
-  convincing += clamp(Math.min(numbers*4, 40)); // numeric outcomes presence
-  convincing = clamp(convincing);
-
-  // Overall weighted: 40% BoFu / 30% Convincing / 30% Technical
-  const overall = clamp(0.4*bofu + 0.3*convincing + 0.3*technical);
-
-  // Positives & improvements
-  const positives: string[] = [];
-  const improvements: string[] = [];
-
-  if (title) positives.push("Title present");
-  else improvements.push("Add a clear, keyworded <title>");
-
-  if (meta) positives.push("Meta description present");
-  else improvements.push("Add a crisp meta description (≈150–160 chars)");
-
-  if (h1) positives.push("H1 present");
-  else improvements.push("Add a single, descriptive H1");
-
-  if (canonical) positives.push("Canonical tag present");
-  else improvements.push("Add a canonical link tag");
-
-  if (hasHttps) positives.push("HTTPS in place");
-  else improvements.push("Serve over HTTPS");
-
-  if (forms>0) positives.push("Lead form available");
-  else improvements.push("Add a short lead form above the fold (or sticky contact)");
-
-  if (ctaHit) positives.push("CTA language detected");
-  else improvements.push("Strengthen CTA copy (clear primary action)");
-
-  if (priceLike) positives.push("Pricing signals found");
-  else improvements.push("Expose pricing/quote path (plans, ranges, or 'Get a quote')");
-
-  if (telLinks+mailtoLinks>0) positives.push("Direct contact links present");
-  else improvements.push("Offer tel/mailto or WhatsApp for quick contact");
-
-  const mgmt =
-    `Positioning snapshot — Overall ${Math.round(overall)}. Focus on BoFu (${Math.round(bofu)}), ` +
-    `Convincing (${Math.round(convincing)}), Technical (${Math.round(technical)}). ` +
-    `Next moves: tighten conversion path (form/CTA), surface pricing, and ensure basic technical hygiene.`;
-
-  return {
-    scores: { overall, bofu, convincing, technical },
-    positives, improvements, mgmt
-  };
-}
-
 async function run(target: string){
   const res = await fetch(target, {
     headers: {
       "user-agent": "LP-Checker/1.0 (+lp-checker-tool.vercel.app)",
       "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
     },
     cache: "no-store",
   });
   const html = await res.text();
   const $ = cheerio.load(html);
-  return computeScores($, target);
+  const ENGINE =
+    process.env.SCORE_ENGINE ??
+    process.env.NEXT_PUBLIC_SCORE_ENGINE ??
+    process.env.ENGINE_VERSION ??
+    "v1";
+  const engine: ScoreEngine = ENGINE === "v2" ? scoreV2 : scoreV1;
+  return engine({ $, url: target });
 }
 
 export async function GET(req: Request){
   const u = new URL(req.url);
   const target = (u.searchParams.get("url") || "").toString().trim();
   if(!target){
     return Response.json({ ok:true, ping:"up" }, { status: 200 });
   }
   try{
     const out = await run(target);
     return Response.json(out, { status: 200 });
   }catch(e:any){
     return Response.json({ ok:false, error: e?.message || String(e) }, { status: 500 });
   }
 }
 
 export async function POST(req: Request){
   try{
     const body = await req.json().catch(()=>({}));
     const target = (body?.url || "").toString().trim();
     if(!target){
       return Response.json({ ok:false, error:"Missing 'url' in body" }, { status: 400 });
     }
     const out = await run(target);
     return Response.json(out, { status: 200 });
