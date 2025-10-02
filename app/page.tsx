'use client';
import { useState } from "react";
import Script from "next/script";

/**
 * FINAL HOTFIX:
 * - White-PDF bug fixed
 * - URL visible in PDF
 * - Headings in score cards visible
 * - Removed thumbs feedback
 * - Tooltips visible in UI, hidden in PDF
 * - Checklist title styled like "Executive summary" (no "1.")
 */

// --- ifm-v3 adapter (keine UI-Änderung) ---
type IfmV3 = {
  version: 'ifm-v3';
  overall: number;
  pillarBreakdown?: Record<string, number>;
  signals?: Record<string, any>;
  notes?: string[];
};

function mapIfmV3ToLegacy(v3: IfmV3): Result {
  const pb = v3.pillarBreakdown || {};
  // konservative Zuordnung
  const valueProp = Number(pb['ValueProp'] ?? 0);
  const trust = Number(pb['Trust'] ?? 0);
  const ux = Number(pb['UX'] ?? 0);
  const form = Number(pb['Form'] ?? 0);
  const speed = Number(pb['Speed'] ?? 0);
  const sea = Number(pb['SEAIntent'] ?? 0);

  const convincing = avg([valueProp, trust, sea].filter((n) => isFinite(n) && n>0));
  const technical = avg([ux, speed].filter((n) => isFinite(n) && n>0));
  const bofu = form || Math.round((v3.signals?.formFieldsCount ?? 0) > 0 ? 67 : 34);

  const improvements = Array.isArray(v3.notes) ? v3.notes : undefined;
  const mgmt = improvements && improvements.length
    ? improvements.slice(0,2).join(' ')
    : undefined;

  const out = {
    scores: {
      overall: Math.round(Number(v3.overall) || 0),
      bofu: Math.round(Number(bofu) || 0),
      convincing: Math.round(Number(convincing) || 0),
      technical: Math.round(Number(technical) || 0),
    },
    improvements,
    mgmt,
  };
  (out as any)._backendVersion = 'ifm-v3';
  return out;
}

function avg(arr:number[]){
  if(!arr || arr.length===0) return 0;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}
// --- end ifm-v3 adapter ---
async function exportReportPDF() {
  if (typeof window === "undefined") return;
  const root = document.getElementById("report-root") as HTMLElement | null;
  const h2p = (window as any).html2pdf;
  if (!root || !h2p) return;

  const detailsList = Array.from(root.querySelectorAll("details")) as HTMLDetailsElement[];
  const prevOpen = detailsList.map(d => d.open);
  detailsList.forEach(d => (d.open = true));

  const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
  const promises: Promise<void>[] = [];
  imgs.forEach(img => {
    if (img.getAttribute("loading") === "lazy") img.setAttribute("loading","eager");
    const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-lazy");
    if (dataSrc && !img.src) img.src = dataSrc;
    if (img.complete && img.naturalWidth > 0) return;
    promises.push((img.decode ? img.decode() : Promise.resolve()).catch(()=>{}));
  });

  const style = document.createElement("style");
  style.setAttribute("data-export-style","true");
  style.textContent = `
    @page { size: A4; margin: 10mm; }
    #report-root { background: #fff !important; color: #000 !important; }
    #report-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    #report-root a { color: #000 !important; text-decoration: none; }
    #report-root * { transform: none !important; position: static !important; }
    #report-root .score-card { background: #ffffff !important; color: #000 !important; border: 1px solid #bbb !important; border-radius: 8px; padding: 8px; }
    #report-root .score-card h4 { color: #000 !important; font-weight: 800 !important; margin-bottom: 6px !important; }
    #report-root .score-card small { color:#000 !important; }
    #report-root .bar { height: 10px; background: #eee !important; border-radius: 8px; overflow: hidden; margin: 8px 0; }
    #report-root .bar span { display: block; height: 100%; background: #ff6e00 !important; }
    #report-root .score-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    #report-root .info-tip { display: none !important; }
  `;
  document.head.appendChild(style);

  await new Promise(r => requestAnimationFrame(()=>r(null)));
  try { await Promise.all(promises); } catch {}

  const opt = {
    margin:       [10,10,10,10],
    filename:     "Landingpage-Report.pdf",
    pagebreak:    { mode: ["css","legacy","avoid-all"] },
    html2canvas:  {
      scale: 2.5,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
      letterRendering: true,
      logging: false,
      windowWidth: Math.max(document.documentElement.clientWidth, 1200),
      windowHeight: root.scrollHeight + 200
    },
    jsPDF:        { unit: "mm", format: "a4", orientation: "portrait" }
  };

  try {
    await h2p().set(opt).from(root).save();
  } finally {
    detailsList.forEach((d, i) => (d.open = prevOpen[i]));
    if (style && style.parentNode) style.parentNode.removeChild(style);
  }
}

type Scores = { overall:number; bofu:number; convincing:number; technical:number };
type Result = { scores: Scores; positives?: string[]; improvements?: string[]; mgmt?: string };

function Qual({score}:{score:number}){
  const s = Math.round(score||0);
  if(s>=67) return <>High</>;
  if(s>=34) return <>Medium</>;
  return <>Low</>;
}

function scoreClass(n:number){
  const s = Math.round(n||0);
  return s>=67? "bar-hi": s>=34? "bar-mid":"bar-lo";
}

function shorten(u:string, max=72){
  if(!u) return "";
  if(u.length<=max) return u;
  return u.slice(0, Math.floor(max*0.6)) + "…"+ u.slice(-Math.floor(max*0.3));
}

export default function Page(){
  const [url,setUrl] = useState("");
  const [loading,setLoading] = useState(false);
  const [data,setData] = useState<Result|null>(null);
  const [pdfReady, setPdfReady] = useState(false);

  async function analyze(){
    if(!url) return;
    setLoading(true); setData(null);
    try{
      const res = await fetch(`/api/analyze?version=ifm-v3&url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`API error: ${res.status}`);
      const raw = await res.json();
      let j:any;
      if (raw && raw.version === 'ifm-v3') {
        j = mapIfmV3ToLegacy(raw);
      } else if (raw?.scoring?.version === 'ifm-v3') {
        // Construct synthetic v3 from legacy root + scoring meta
        const v3 = {
          version: 'ifm-v3',
          overall: raw?.scores?.overall ?? 0,
          pillarBreakdown: {
            Form: raw?.scores?.bofu ?? 0,
            UX: raw?.scores?.technical ?? 0,
            SEAIntent: raw?.scores?.convincing ?? 0,
          },
          signals: {},
          notes: Array.isArray(raw?.improvements) ? raw.improvements : []
        } as any;
        j = mapIfmV3ToLegacy(v3);
        (j as any)._backendVersion = 'ifm-v3 (scoring)';
      } else {
        j = raw;
      }
      if (!j?._backendVersion) j = { ...(j||{}), _backendVersion: (raw?.version || 'legacy') };
      setData(j);
    }catch(e:any){ alert(e?.message || "Failed to analyze"); }
    finally{ setLoading(false); }
  }

  return (
    <main className="container">
      <section className="hero card">
        <h1>Bottom of Funnel (BoFu) Landing Page Checker</h1>
        <p className="sub">
          Focus: BOFU (CTA, form/contact, pricing) + Convincing (benefits, trust, objections, visuals).
          Technical is a basic hygiene light-check. Export as PDF available.
        </p>
        <p className="sub" style={{marginTop:6}}>
          This tool evaluates SEA/BoFu landing pages for structure, clarity, and conversion potential. It does not measure real traffic, tracking, Core Web Vitals, or live campaign performance.
        </p>

        <div className="row">
          <input
            type="url"
            placeholder="https://example.com/your-landing-page"
            value={url}
            onChange={(e)=>setUrl(e.target.value)}
          />
          <button className="btn-primary" onClick={analyze} disabled={loading || !url}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
          <button
            className="btn-secondary"
            onClick={exportReportPDF}
            disabled={!pdfReady || !data}
            title={pdfReady ? "Exportiere als PDF" : "Lädt…"}
          >
            {pdfReady ? "Export as PDF" : "PDF wird vorbereitet…"}
          </button>
        </div>

        {url && (
          <div style={{marginTop:8, fontSize:12}}>
            URL: <a href={url} target="_blank" rel="noopener" style={{color:"#ffffff"}}>{shorten(url,72)}</a>
          </div>
        )}
      </section>

      <section className="card exec" id="report-root">
        {url && (
          <div className="print-only" style={{display:'none', fontSize:12, marginBottom:10}}>
            <strong>Page:</strong> <a href={url} rel="noopener">{url}</a>
          </div>
        )}

        {/* Checklist title styled as executive summary */}
        <div className="exec-title" style={{fontSize:"1.75rem", fontWeight:800, marginBottom:10}}>Landing Page Essentials (Checklist)</div>
        <ul style={{marginLeft:18, marginTop:8}}>
          <li>Clear primary CTA above the fold (single dominant action).</li>
          <li>Visible lead path: form, phone, email, or WhatsApp.</li>
          <li>Pricing clarity (plans, ranges, or “Get a quote” path).</li>
          <li>Trust signals: recognizable logos, testimonials, case studies, ratings.</li>
          <li>Benefits stated in outcomes (numbers beat adjectives).</li>
          <li>Objection handling (FAQs, guarantees, policies).</li>
          <li>Meaningful visuals (product/context, not only stock).</li>
          <li>Technical hygiene: title + meta description, H1, canonical, alt text, HTTPS.</li>
        </ul>

        {data && (<>
          <div className="exec">
            <div className="exec-title" style={{fontSize:"1.75rem", fontWeight:800}}>Executive summary</div>
            <div className="muted" style={{color:"#ff6e00", fontWeight:800, fontSize:"1.125rem", marginTop:2}}>
              Overall score: <b>{Math.round(data.scores.overall)}</b>/100 — <Qual score={data.scores.overall}/>
            </div>
            {data.mgmt && <div className="exec-text" style={{marginTop:6}}>{data.mgmt}</div>}
          </div>

          <div className="score-grid">
            <div className="score-card">
              <h4>Overall <sup className="info-tip"><small><abbr title="Weighted combination: 40% BoFu, 30% Convincing, 30% Technical.">info</abbr></small></sup></h4>
              <div className="bar">
                <span className={scoreClass(data.scores.overall)} style={{width:`${Math.round(data.scores.overall)}%`}}/>
              </div>
              <small><Qual score={data.scores.overall}/></small>
            </div>

            <div className="score-card">
              <h4>Purchase / BoFu <sup className="info-tip"><small><abbr title="Conversion path: form/CTA, direct contact options, pricing signals.">info</abbr></small></sup></h4>
              <div className="bar">
                <span className={scoreClass(data.scores.bofu)} style={{width:`${Math.round(data.scores.bofu)}%`}}/>
              </div>
              <small><Qual score={data.scores.bofu}/></small>
            </div>

            <div className="score-card">
              <h4>Convincing <sup className="info-tip"><small><abbr title="Trust signals: testimonials, case studies, certifications; outcome evidence.">info</abbr></small></sup></h4>
              <div className="bar">
                <span className={scoreClass(data.scores.convincing)} style={{width:`${Math.round(data.scores.convincing)}%`}}/>
              </div>
              <small><Qual score={data.scores.convincing}/></small>
            </div>

            <div className="score-card">
              <h4>Technical <sup className="info-tip"><small><abbr title="Basic hygiene: title, meta description, H1, canonical, HTTPS.">info</abbr></small></sup></h4>
              <div className="bar">
                <span className={scoreClass(data.scores.technical)} style={{width:`${Math.round(data.scores.technical)}%`}}/>
              </div>
              <small><Qual score={data.scores.technical}/></small>
            </div>
          </div>

          <p className="note">
            Disclaimer: This checker parses static HTML only. No tracking, Core Web Vitals, or client-rendered JS.
          </p>

          <div className="two-col">
            <div>
              <h4>What works</h4>
              <ul>{(data.positives||[]).map((t,i)=>(<li key={i}>{t}</li>))}</ul>
            </div>
            <div>
              <h4>Improvements</h4>
              <ul>{(data.improvements||[]).map((t,i)=>(<li key={i}>{t}</li>))}</ul>
            </div>
          </div>
        </>)}
      </section>

      <footer className="footer">
        © Tim Clausen 2025 — This tool targets SEA/BoFu landing pages, not general websites.
      </footer>

      <Script
        src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"
        strategy="afterInteractive"
        onLoad={()=>{
          if (typeof window !== "undefined") {
            setTimeout(()=> (window as any).html2pdf ? setPdfReady(true) : setPdfReady(false), 60);
          }
        }}
      />
    
      {/* Non-invasive backend version indicator */}
      <div style={{fontSize:'10px', opacity:0.6, marginTop:'8px'}}>
        Backend version: {(data as any)?._backendVersion || 'unknown'}
      </div>
    
    </main>
  );
}
