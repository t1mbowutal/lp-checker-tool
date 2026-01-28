import * as cheerio from 'cheerio';
import { scoreLanding } from '../../../src/lib/scoring';
export const runtime='nodejs';export const dynamic='force-dynamic';
function clamp(n:number,min=0,max=100){return Math.max(min,Math.min(max,Math.round(n)));}
function textScore(t:string,n:string[],h=25,m=100){let s=0;const l=t.toLowerCase();for(const x of n){if(l.includes(x))s+=h;}return clamp(s,0,m);} 

function clean(s:string){
  return (s||'').replace(/\s+/g,' ').trim();
}

function pickText($:any, sel:string){
  return clean($(sel).map((_:any,e:any)=>$(e).text()).get().join(' '));
}

function gatherCtas($:any){
  const ctaNodes = $('a, button, input[type="submit"], input[type="button"]');
  const items = ctaNodes.map((_:any,el:any)=>{
    const t = clean($(el).text() || $(el).attr('value') || $(el).attr('aria-label') || '');
    const href = ($(el).attr('href')||'').toString();
    const cls = ($(el).attr('class')||'').toString();
    const role = ($(el).attr('role')||'').toString();
    const data = `${t} ${href} ${cls} ${role}`.toLowerCase();
    return { t, data };
  }).get() as {t:string;data:string}[];

  // keep only actionable-ish elements (avoid nav spam)
  const filtered = items
    .filter(x => x.t.length >= 3 || /\b(download|whitepaper|demo|contact|learn|angebot|anfragen)\b/i.test(x.data))
    .slice(0, 80);

  const blob = filtered.map(x => x.data).join(' ');
  return { items: filtered, blob };
}

function computeScores($:any,url:string){
  const html=$.html()||'';
  const text=($.text()||'');
  const textLower=text.toLowerCase();

  const hasHttps=url.startsWith('https://');
  const title=clean($('title').first().text());
  const meta=clean($('meta[name="description"]').attr('content')||'');
  const canonical=clean($('link[rel="canonical"]').attr('href')||'');

  const h1Count=$('h1').length;
  const h1=clean($('h1').first().text());
  const headingsTotal=$('h1,h2,h3').length;

  const forms=$('form').length;
  const telLinks=$('a[href^="tel:"]').length;
  const mailtoLinks=$('a[href^="mailto:"]').length;

  const { items: ctas, blob: ctaBlob } = gatherCtas($);

  // --- Intent classification (lead capture vs content offer vs product/info) ---
  const isLeadCta = /\b(contact|demo|request|quote|angebot|anfragen|kontakt|termin|trial|get started|sales|talk to|call)\b/i.test(ctaBlob);
  const isContentCta = /\b(download|whitepaper|pdf|guide|report|ebook|checklist|webinar|datasheet|case study|success story)\b/i.test(ctaBlob);
  const intent = (forms>0 || telLinks+mailtoLinks>0 || isLeadCta) ? 'lead_capture'
              : (isContentCta ? 'content_offer'
              : 'product_info');

  // --- Technical hygiene ---
  let technical=0;
  if(hasHttps) technical+=18;
  if(title && title.length>=10) technical+=18;
  if(meta && meta.length>=50) technical+=18;
  if(canonical) technical+=12;
  if($('meta[property="og:title"]').length || $('meta[property="twitter:title"]').length) technical+=8;
  if($('meta[name="viewport"]').length) technical+=8;
  if(headingsTotal>=3) technical+=8;
  technical = clamp(technical);

  // --- Conversion readiness ("BoFu") ---
  const hasDownload = /\b(download|whitepaper|pdf|ebook|report|datasheet|guide)\b/i.test(ctaBlob);
  const hasLearnMore = /\b(learn more|read more|learn|discover|more about)\b/i.test(ctaBlob);
  const hasPricingLike = /\b(€|eur|usd|\$|price|pricing|angebot|kosten|prei\w*|quote)\b/i.test(text);

  // Above-the-fold CTA proxy (cheap, but works): first 30% of DOM text
  const snippet = textLower.slice(0, Math.min(textLower.length, Math.floor(textLower.length*0.30)));
  const atfCta = /\b(download|whitepaper|demo|contact|angebot|anfragen|kontakt|learn more|get started|request)\b/i.test(snippet);

  let bofu=0;
  if(intent==='lead_capture'){
    if(forms>0) bofu+=45;
    if(telLinks+mailtoLinks>0) bofu+=18;
    if(isLeadCta) bofu+=22;
    if(hasPricingLike) bofu+=15;
    if(atfCta) bofu+=10;
  } else if(intent==='content_offer'){
    if(hasDownload) bofu+=45;
    if(ctas.length>=2) bofu+=15;
    if(atfCta) bofu+=10;
    // content offers often do not show pricing or forms
    if(isLeadCta) bofu+=10;
  } else { // product_info
    if(hasLearnMore) bofu+=18;
    if(isLeadCta) bofu+=22;
    if(telLinks+mailtoLinks>0) bofu+=12;
    if(hasPricingLike) bofu+=18;
    if(atfCta) bofu+=10;
  }
  bofu = clamp(bofu);

  // --- Convincing (Value prop + Trust) ---
  const trustWords=[
    'testimonial','case study','review','rating','kundenstimme','referenz','success story','reference',
    'g2','capterra','gartner','forrester','iso','din','cert','zert','compliance','security','cyber'
  ];
  const benefitWords=[
    'roi','save','saving','reduce','increase','improve','faster','less than','minutes','hours',
    'availability','downtime','quality','efficiency','predict','prevent','monitor','alerts','transparency',
    'kosten','einsparen','reduzieren','steiger','schneller','vermeiden'
  ];

  const blockquotes=$('blockquote').length;
  const quoteLike=(text.match(/\“|\”|\"|\'\'|\>\s*\>\s*\>/g)||[]).length;
  const isoLike=/\biso\s*\d{4,5}\b/i.test(text);

  let trust=0;
  trust += textScore(text, trustWords, 10, 55);
  trust += clamp(Math.min((blockquotes+quoteLike)*10, 30));
  if(isoLike) trust += 15;
  trust = clamp(trust);

  let valueProp=0;
  valueProp += textScore(text, benefitWords, 6, 60);
  // numbers as proof (ROI %, time-to-value, etc.)
  const numbers=(text.match(/\b\d{1,3}(?:[\.,]\d{1,3})?\b/g)||[]).length;
  valueProp += clamp(Math.min(numbers*3, 35));
  // question headlines (problem framing)
  const questions=(text.match(/\?/g)||[]).length;
  valueProp += clamp(Math.min(questions*4, 20));
  valueProp = clamp(valueProp);

  const convincing = clamp(Math.round(0.55*trust + 0.45*valueProp));

  // --- Overall ---
  const overall = clamp(Math.round(0.40*bofu + 0.35*convincing + 0.25*technical));

  // --- Positives & Improvements (human-readable) ---
  const positives:string[]=[];
  const improvements:string[]=[];

  if(title) positives.push('Title present'); else improvements.push('Add a clear, keyworded <title>');
  if(meta) positives.push('Meta description present'); else improvements.push('Add a crisp meta description (≈150–160 chars)');
  if(h1) positives.push('H1 present'); else improvements.push('Add a descriptive first H1');
  if(h1Count>1) positives.push('Multiple H1s detected (allowed)');
  if(canonical) positives.push('Canonical tag present'); else improvements.push('Add a canonical link tag');
  if(hasHttps) positives.push('HTTPS enabled'); else improvements.push('Use HTTPS');

  // Intent-specific checks
  if(intent==='lead_capture'){
    if(forms>0 || (telLinks+mailtoLinks)>0) positives.push('Clear lead capture option');
    else improvements.push('Add a clear lead capture option (form, call or email)');
  }
  if(intent==='content_offer'){
    if(hasDownload) positives.push('Content-offer CTA detected (e.g., whitepaper / download)');
    else improvements.push('Add a clear content-offer CTA (e.g., download/whitepaper)');
  }
  if(intent==='product_info'){
    if(isLeadCta) positives.push('Next-step CTA detected (contact/demo/request)');
    else improvements.push('Add a clear next-step CTA (contact/demo/request)');
  }

  if(trust>=55) positives.push('Strong trust signals (proof, references, certification)');
  else if(trust<34) improvements.push('Add trust signals (quotes, references, certifications, logos)');

  if(valueProp>=55) positives.push('Strong value proposition & benefits');
  else if(valueProp<34) improvements.push('Make benefits more concrete (outcomes, numbers, specific use cases)');

  return {
    scores:{overall,bofu,convincing,technical},
    positives,
    improvements,
    _title:title||null,
    _h1:h1||null
  };
}
async function run(target:string){const res=await fetch(target,{headers:{'user-agent':'LP-Checker/1.0 (+lp-checker-tool.vercel.app)','accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},cache:'no-store'});const html=await res.text();const $=cheerio.load(html);const out=computeScores($,target);return {...out,ok:res.ok,status:res.status,url:target};}
export async function GET(req:Request){const u=new URL(req.url);const target=(u.searchParams.get('url')||'').toString().trim();if(!target){return Response.json({ok:true,ping:'up'},{status:200});}const out=await run(target);const goal=u.searchParams.get('goal')||undefined;const fieldsParam=u.searchParams.get('fields');const fieldsNum=fieldsParam?Number(fieldsParam):undefined;const signals={h1:out._h1??undefined,pageTitle:out._title??undefined,httpStatusOk:out.ok,funnelGoal:goal as any,formFieldsCount:Number.isFinite(fieldsNum as number)?(fieldsNum as number):undefined};const scoring=scoreLanding(signals);return Response.json({...out,scoring},{status:out.ok?200:(out.status||500)});}
export async function POST(req:Request){try{const body=await req.json().catch(()=>({}));const target=(body?.url||'').toString().trim();if(!target){return Response.json({ok:false,error:'Missing "url" in body'},{status:400});}const out=await run(target);const signals={h1:out._h1??undefined,pageTitle:out._title??undefined,httpStatusOk:out.ok,formFieldsCount:(body.formFieldsCount??undefined) as number|undefined,funnelGoal:(body.funnelGoal??undefined) as string|undefined};const scoring=scoreLanding(signals);return Response.json({...out,scoring},{status:200});}catch(e:any){return Response.json({ok:false,error:e?.message||String(e)},{status:500});}}