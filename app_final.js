const qs = s => document.querySelector(s);

function shortenUrl(url){
  try {
    const u = new URL(url);
    let path = u.pathname.split('/').filter(Boolean);
    let display = u.hostname + (path.length? '/' + path[0] + (path.length>1? '/…':'') : '');
    return display;
  } catch { return url; }
}

const checklistItems = [
  `Open example landingpage: <a class="link" href="./example.html" target="_blank">minimal demo</a>`,
  "Clear H1 with value proposition",
  "Primary CTA above the fold",
  "Secondary CTA or phone/email",
  "Short lead form (≤5 fields) or direct contact route",
  "Trust elements (testimonials, reviews, clients)",
  "Objection handling (FAQ, price clarity, delivery/installation)",
  "Benefit-led bullets (not only features)",
  "Visuals that show the product/service in use",
  "Tracking in place (GTM/GA/Meta/LI)",
  "Fast load perception (≤2.5s LCP proxy)*",
  "Mobile friendliness (viewport meta present)",
  "Privacy & legal links present"
];
(function initChecklist(){
  const ul = qs('#checklist');
  ul.innerHTML = checklistItems.map(t => `<li>□ ${t}</li>`).join("");
})();

async function fetchHtmlViaProxy(target){
  const prox = target.replace(/^https?:\/\//, "");
  const url = `https://r.jina.ai/http://${prox}`;
  const res = await fetch(url, { headers: { "Accept": "text/html" } });
  if(!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return await res.text();
}

function count(regex, str){ let c=0,m; while((m=regex.exec(str))!==null){ c++; if(c>500) break; } return c; }

function analyze(html){
  const lower = html.toLowerCase();
  const h1 = (html.match(/<h1[^>]*>(.*?)<\/h1>/is)||[])[1]||"";
  const hasH1 = !!h1 && h1.replace(/<[^>]+>/g,"").trim().length>3;

  const ctaRegex = /(get(\s?a)? quote|get started|start now|kontakt|angebot|anfrage|buy now|book (a )?demo|free trial|request|kontaktieren|termin|jetzt (kaufen|anfragen|bestellen|buchen)|add to cart|shop now)/i;
  const ctas = count(new RegExp(ctaRegex, "gi"), lower);
  const hasCTA = ctas>0;
  const first800 = lower.slice(0, 800);
  const ctaAbove = ctaRegex.test(first800);

  const formFields = count(/<input\b[^>]+(type|name)=/gi, lower);
  const shortForm = formFields>0 && formFields<=6;

  const hasPhone = /(tel:|\+?\d[\d\s\/()-]{6,})/.test(lower);
  const hasEmail = /mailto:|@/.test(lower);

  const trust = /(testimonial|review|kundenstimme|bewertung|sterne|trustpilot|case study|referen[cz]|kunden)/i.test(lower) || /★|⭐/.test(lower);
  const logos = count(/<img[^>]+alt=["'][^"']*(logo|client|brand|kunde)/gi, lower)>0;
  const socialProof = trust || logos;

  const objections = /(faq|fragen|garantie|preis|lieferung|installation|warranty|returns|shipping)/i.test(lower);
  const benefits = /(benefit|vorteil|why|warum|value|nutzen)/i.test(lower) || count(/<li>.*?<\/li>/gis, lower)>4;
  const visuals = /<img|<video|<picture/i.test(lower);
  const tracking = /(gtm-|google tag manager|gtag\(|googletagmanager\.com|facebook\.com\/tr|linkedininsighttag)/i.test(lower);

  const imgCount = count(/<img\b/gi, lower);
  const scriptCount = count(/<script\b/gi, lower);
  const hasAnyAssets = (imgCount+scriptCount)>0;
  const fastPerception = hasAnyAssets ? (imgCount < 25 && scriptCount < 25) : true;

  let purchase = (hasCTA?25:0) + (ctaAbove?15:0) + (shortForm?10:6) + ((hasPhone||hasEmail)?8:0) + (objections?8:0) + (tracking?8:0);
  let convincing = (hasH1?12:0) + (benefits?12:0) + (socialProof?14:0) + (visuals?12:0) + (objections?8:0);
  let technical = (fastPerception?8:4) + (hasAnyAssets?6:0);

  const purchaseScore = Math.min(100, purchase);
  const convincingScore = Math.min(100, convincing);
  const technicalScore = Math.min(100, technical);
  let overall = Math.round( purchaseScore*0.5 + convincingScore*0.35 + technicalScore*0.15 );

  if(overall<30 && (purchaseScore+convincingScore)>60) overall=60;

  return { scores:{overall,purchase:purchaseScore,convincing:convincingScore,technical:technicalScore}, ctas, ctaAbove, formFields, hasCTA, hasH1, benefits, socialProof, visuals, objections, tracking, phoneEmail:(hasPhone||hasEmail) };
}

function scoreLabel(score){
  if(score>=90) return "Excellent";
  if(score>=75) return "Strong";
  if(score>=55) return "Fair";
  if(score>=40) return "Weak";
  return "Poor";
}

function render(results, url){
  qs("#reportEmpty").classList.add("hidden");
  qs("#report").classList.remove("hidden");

  const { scores } = results;
  const shortUrl = shortenUrl(url);

  qs("#summary").innerHTML = `<div><strong>Executive summary:</strong> Overall score: <strong>${scores.overall}/100</strong> — ${scoreLabel(scores.overall)}</div><div class="muted">URL: <a class="link" href="${url}" target="_blank">${shortUrl}</a></div>`;

  const renderBar = (label, score) => `<div class="bar"><div class="title"><span>${label}</span><span>${score}/100 — ${scoreLabel(score)}</span></div><div class="progress"><span style="width:${Math.max(1, score)}%"></span></div></div>`;
  qs("#bars").innerHTML = renderBar("Overall", scores.overall) + renderBar("Purchase / BOFU", scores.purchase) + renderBar("Convincing", scores.convincing) + renderBar("Technical", scores.technical);

  const good=[],improve=[],critical=[];
  if(results.hasCTA){ good.push("Primary CTA found."); if(results.ctaAbove) good.push("CTA visible above the fold."); } else critical.push("No clear CTA detected.");
  if(results.formFields>0){ if(results.formFields<=6) good.push("Lead form length OK."); else improve.push("Form longer than recommended (aim ≤5)."); } else improve.push("Consider adding a short lead form or contact route.");
  if(results.phoneEmail) good.push("Phone/email contact found."); else improve.push("Add a secondary contact option.");
  if(results.socialProof) good.push("Trust/social proof present."); else improve.push("Add testimonials or client logos.");
  if(results.benefits) good.push("Benefit-led copy detected."); else improve.push("Strengthen benefits, not only features.");
  if(results.visuals) good.push("Visuals present."); else improve.push("Add product/service visuals.");
  if(results.objections) good.push("Objection handling present."); else improve.push("Add FAQ or address common objections.");
  if(results.tracking) good.push("Tracking detected."); else critical.push("No tracking detected.");

  const mk = (title,items)=>`<div class="block"><h3>${title}</h3><ul class="list">${items.map(i=>`<li>${i}</li>`).join("")}</ul></div>`;
  qs("#findings").innerHTML = mk("What works",good)+mk("Improvements",improve)+mk("Critical",critical);
}

async function run(){
  const input = qs("#targetUrl");
  const url = input.value.trim();
  if(!url){ alert("Please paste a URL."); return; }
  qs("#reportEmpty").classList.remove("hidden");
  qs("#report").classList.add("hidden");
  qs("#reportEmpty").textContent = "Analyzing…";
  try{
    const html = await fetchHtmlViaProxy(url);
    const results = analyze(html);
    render(results,url);
  }catch(e){ console.error(e); qs("#reportEmpty").textContent = "Error fetching/analyzing URL."; }
}

qs("#analyzeBtn").addEventListener("click", run);
qs("#targetUrl").addEventListener("keydown", e=>{ if(e.key==="Enter") run(); });
qs("#exportBtn").addEventListener("click", ()=>{
  const element = document.querySelector("#report");
  if(element.classList.contains("hidden")){ alert("Run an analysis first."); return; }
  const opt={margin:0.5,filename:'landingpage-checker-report.pdf',image:{type:'jpeg',quality:0.98},html2canvas:{scale:2,useCORS:true,allowTaint:true},jsPDF:{unit:'in',format:'a4',orientation:'portrait'}};
  html2pdf().from(element).set(opt).save();
});