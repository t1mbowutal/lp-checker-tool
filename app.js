
// Old-look UI + improved scoring + checklist contains example link.
const qs = s => document.querySelector(s);

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
  "Canonical tag & indexability",
  "Fast load perception (≤2.5s LCP proxy)*",
  "Mobile friendliness (viewport meta present)",
  "Privacy & legal links present"
];
(function initChecklist(){
  const ul = qs('#checklist');
  ul.innerHTML = checklistItems.map(t => `<li>□ ${t}</li>`).join("");
})();

function normalizeUrl(u){
  try{ return new URL(u).href; }catch{ return u? (u.startsWith("http")?u:`https://${u}`) : ""; }
}

async function fetchHtmlViaProxy(target){
  const prox = target.replace(/^https?:\/\//, "");
  const url = `https://r.jina.ai/http://${prox}`;
  const res = await fetch(url, { headers: { "Accept": "text/html" } });
  if(!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return await res.text();
}

function extractMeta(html, name, attr="name"){
  const re = new RegExp(`<meta[^>]+${attr}=["']?${name}["']?[^>]*>`, "i");
  const m = html.match(re);
  if(!m) return "";
  const c = m[0].match(/content=["']([^"']*)["']/i);
  return c?c[1]:"";
}
function count(regex, str){ let c=0,m; while((m=regex.exec(str))!==null){ c++; if(c>500) break; } return c; }

function analyze(html){
  const lower = html.toLowerCase();

  // Content markers
  const h1 = (html.match(/<h1[^>]*>(.*?)<\/h1>/is)||[])[1]||"";
  const hasH1 = !!h1 && h1.replace(/<[^>]+>/g,"").trim().length>3;

  const ctaRegex = /(get\s?(a\s)?quote|get started|start now|kontakt|angebot|anfrage|buy now|book (a )?demo|free trial|request|kontaktieren|termin|jetzt (kaufen|anfragen|bestellen|buchen))/i;
  const ctas = count(new RegExp(ctaRegex, "gi"), lower);
  const hasCTA = ctas>0 || /type=["']submit["']/.test(lower);

  const formFields = count(/<input\b[^>]+(type|name)=/gi, lower);
  const shortForm = formFields>0 && formFields<=6;

  const hasPhone = /(tel:|\+?\d[\d\s\/()-]{6,})/.test(lower);
  const hasEmail = /mailto:|@/.test(lower);

  const trust = /(testimonial|review|kundenstimme|bewertung|sterne|trustpilot|case study|referen[cz]|kunden)/i.test(lower)
    || /★|⭐/.test(lower);
  const logos = count(/<img[^>]+alt=["'][^"']*(logo|client|brand|kunde)/gi, lower)>0;
  const socialProof = trust || logos;

  const objections = /(faq|fragen|garantie|preis|lieferung|installation|warranty|returns|shipping)/i.test(lower);
  const benefits = /(benefit|vorteil|why|warum|value|nutzen)/i.test(lower) || count(/<li>.*?<\/li>/gis, lower)>4;
  const visuals = /<img|<video|<picture/i.test(lower);
  const tracking = /(gtm-|google tag manager|gtag\(\'config|googletagmanager\.com|facebook\.com\/tr|linkedininsighttag|clarity|hotjar)/i.test(lower);

  // Head/tech markers (may be missing if site blocks proxy)
  const title = (html.match(/<title[^>]*>(.*?)<\/title>/is)||[])[1]||"";
  const desc = extractMeta(html, "description");
  const canonical = extractMeta(html, "canonical", "rel") || "";
  const viewport = extractMeta(html, "viewport");
  const robots = extractMeta(html, "robots");
  const indexable = (robots? !/noindex|nofollow/i.test(robots):true);

  const imgCount = count(/<img\b/gi, lower);
  const scriptCount = count(/<script\b/gi, lower);
  const hasAnyAssets = (imgCount+scriptCount)>0;

  // Heuristic performance proxy
  const fastPerception = hasAnyAssets ? (imgCount < 25 && scriptCount < 25) : true; // don't punish if content is hidden

  // --- Scoring (sharpened & more robust) ---
  // We down-weight technical if head/asset signals are likely missing.
  const techSignalStrength = [
    title?1:0, desc?1:0, viewport?1:0, canonical?1:0, hasAnyAssets?1:0
  ].reduce((a,b)=>a+b,0) / 5; // 0..1

  const purchase = (
    (hasCTA?28:0) +
    (shortForm?14: (formFields>0?6:8)) +
    ((hasPhone||hasEmail)?10:0) +
    (objections?10:0) +
    (tracking?10:0)
  );
  const convincing = (
    (hasH1?16:0) +
    (benefits?12:0) +
    (socialProof?16:0) +
    (visuals?10:0) +
    (objections?10:0)
  );
  let technical = (
    (canonical?10:0) +
    (viewport?10:0) +
    (indexable?10:0) +
    (fastPerception?10:4) +
    (title.length>=20 && title.length<=65 ?10: (title?6:4)) +
    (desc.length>=50 && desc.length<=160 ?10: (desc?6:4))
  );
  // Down-weight if signals missing (avoid harsh penalties on blocked pages)
  technical = Math.round( technical * (0.6 + 0.4*techSignalStrength) );

  const purchaseScore = Math.min(100, purchase);
  const convincingScore = Math.min(100, convincing);
  const technicalScore = Math.min(100, technical);

  // Overall weighting with safety floor if BOFU is strong
  let overall = Math.round( purchaseScore*0.45 + convincingScore*0.35 + technicalScore*0.20 );
  if(purchaseScore>=60 && overall<40) overall = 40; // safety floor to avoid counterintuitive outputs

  const checks = {
    h1: hasH1, cta: hasCTA, shortForm,
    phoneOrEmail: hasPhone||hasEmail, trust: socialProof, objections, benefits, visuals, tracking,
    canonical: !!canonical, viewport: !!viewport, indexable, fastPerception
  };

  return {
    title, desc, canonical, robots, viewport,
    scores: { overall, purchase: purchaseScore, convincing: convincingScore, technical: technicalScore },
    checks,
    counts: { imgCount, scriptCount, formFields, ctas }
  };
}

function scoreToBadge(score){
  if(score>=80) return `<span class="badge ok">Strong</span>`;
  if(score>=55) return `<span class="badge warn">Mixed</span>`;
  return `<span class="badge bad">Weak</span>`;
}
function renderBar(label, score){
  return `<div class="bar">
    <div class="title"><span>${label}</span><span>${score}/100</span></div>
    <div class="progress"><span style="width:${Math.max(1, score)}%"></span></div>
  </div>`;
}

function render(results, url){
  qs("#reportEmpty").classList.add("hidden");
  qs("#report").classList.remove("hidden");

  const { scores, checks, title, desc, canonical, robots, viewport, counts } = results;
  const stance = scores.purchase >= 60 && scores.convincing >= 60
    ? "Balanced, BOFU-ready"
    : (scores.purchase >= 60 ? "Purchase-focused, tighten proof" : "Convincing-first, strengthen CTAs & forms");

  qs("#summary").innerHTML = `
    <div><strong>Executive summary:</strong> ${stance}. Overall score: <strong>${scores.overall}/100</strong> ${scoreToBadge(scores.overall)}</div>
    <div class="muted">URL: <small class="mono">${url}</small></div>
  `;

  qs("#bars").innerHTML =
    renderBar("Overall", scores.overall) +
    renderBar("Purchase / BOFU", scores.purchase) +
    renderBar("Convincing", scores.convincing) +
    renderBar("Technical SEO", scores.technical);

  const good = [], improve = [], critical = [];
  if(checks.h1) good.push("Clear H1/value prop found."); else critical.push("No clear H1/value proposition detected.");
  if(checks.cta) good.push(`Primary CTA found (${counts.ctas}+ matches).`); else critical.push("Primary CTA not detected above the fold.");
  if(checks.shortForm) good.push(`Lead form length OK (${counts.formFields} fields).`);
  else if(counts.formFields>0) improve.push(`Form seems long (${counts.formFields} fields) – aim ≤ 5.`);
  else improve.push("Consider a short BOFU form or phone/email route.");
  if(checks.phoneOrEmail) good.push("Secondary contact route present (phone/email)."); else improve.push("Add a visible secondary contact route (phone/email).");
  if(checks.trust) good.push("Trust or social proof present."); else improve.push("Add testimonials, client logos, or review snippets.");
  if(checks.objections) good.push("Objection handling present (FAQ/price/installation)."); else improve.push("Add concise FAQ or address typical objections.");
  if(checks.benefits) good.push("Benefit-led copy detected."); else improve.push("Strengthen benefit-led bullets (not only features).");
  if(checks.visuals) good.push("Relevant visuals present."); else improve.push("Add product-in-context visuals or short demo video.");
  if(checks.tracking) good.push("Tracking scripts detected (GTM/GA/Meta/LI)."); else critical.push("No tracking detected – set up GTM/GA & ad pixels.");
  if(checks.canonical) good.push("Canonical tag found."); else improve.push("Add a canonical tag.");
  if(checks.viewport) good.push("Viewport meta present (mobile friendly)."); else critical.push("Missing viewport meta – mobile layout at risk.");
  if(checks.indexable) good.push("Indexable (no noindex found)."); else improve.push("Robots suggest noindex/nofollow – confirm intention.");
  if(checks.fastPerception) good.push("Perceived lightweight (assets under soft limits)."); else improve.push("Heavy asset footprint – compress & defer non-critical.");

  const mk = (title, items)=>`<div class="block"><h3>${title}</h3><ul class="list">${items.map(i=>`<li>${i}</li>`).join("")}</ul></div>`;
  qs("#findings").innerHTML = mk("What works", good) + mk("Improvements", improve) + mk("Critical", critical);

  qs("#tech").innerHTML = `
    <div class="block">
      <h3>Technical details</h3>
      <ul class="list">
        <li><strong>Title:</strong> ${title?title:"—"}</li>
        <li><strong>Meta description:</strong> ${desc?desc:"—"}</li>
        <li><strong>Canonical:</strong> ${canonical?canonical:"—"}</li>
        <li><strong>Robots:</strong> ${robots?robots:"—"}</li>
        <li><strong>Viewport:</strong> ${viewport?viewport:"—"}</li>
        <li><strong>Images:</strong> ${counts.imgCount}, <strong>Scripts:</strong> ${counts.scriptCount}</li>
      </ul>
    </div>
  `;
}

async function run(){
  const input = qs("#targetUrl");
  const url = normalizeUrl(input.value.trim());
  if(!url){ alert("Please paste a URL."); return; }
  qs("#reportEmpty").classList.remove("hidden");
  qs("#report").classList.add("hidden");
  qs("#reportEmpty").textContent = "Analyzing…";
  try{
    const html = await fetchHtmlViaProxy(url);
    const results = analyze(html);
    render(results, url);
  }catch(err){
    console.error(err);
    qs("#reportEmpty").textContent = "Error while fetching or analyzing this URL. Try another page or check CORS.";
  }
}

qs("#analyzeBtn").addEventListener("click", run);
qs("#targetUrl").addEventListener("keydown", e=>{ if(e.key==="Enter") run(); });

qs("#exportBtn").addEventListener("click", ()=>{
  const element = document.querySelector("#report");
  if(element.classList.contains("hidden")){ alert("Run an analysis first."); return; }
  const opt = {
    margin:       0.5,
    filename:     'landingpage-checker-report.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().from(element).set(opt).save();
});

// Prefill via ?u=
try{ const u = new URLSearchParams(location.search).get("u"); if(u) qs("#targetUrl").value = u; }catch{}
