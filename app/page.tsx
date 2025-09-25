'use client';
import { useState } from "react";
import Script from "next/script";

/**
 * Robust PDF-Export (eine Datei):
 * - Klont #report-root in einen temporären Container
 * - Inlined CSS erzwingt schwarze Schrift / weißen Hintergrund / A4-Breite
 * - Öffnet <details>, setzt Balkenfarben, fixed width
 * - Übergibt Container an html2pdf, entfernt danach wieder
 */
function exportReportPDF() {
  if (typeof window === "undefined") return;
  const src = document.getElementById("report-root") as HTMLElement | null;
  const h2p = (window as any).html2pdf;
  if (!src || !h2p) return;

  // Clone node
  const clone = src.cloneNode(true) as HTMLElement;
  // ensure details are open
  clone.querySelectorAll("details").forEach(d => (d as HTMLDetailsElement).open = true);

  // Build container with inline CSS
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px"; // offscreen
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.maxWidth = "210mm";
  container.style.background = "#ffffff";
  container.style.color = "#000000";
  container.className = "export-a4";

  const style = document.createElement("style");
  style.textContent = `
    @page { size: A4; margin: 10mm; }
    .export-a4, .export-a4 * { color: #000 !important; background: transparent !important; }
    .export-a4 { width: 210mm !important; }
    .export-a4 .score-grid { display: grid !important; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
    .export-a4 .score-card { border: 1px solid #ddd !important; border-radius: 8px; padding: 12px; }
    .export-a4 .bar { height: 10px; background: #eee !important; border-radius: 8px; overflow: hidden; margin: 8px 0; }
    .export-a4 .bar span { display: block; height: 100%; background: #ff6e00 !important; }
    .export-a4 a { color: #000 !important; text-decoration: none; }
    .export-a4 .muted { color: #333 !important; }
    .no-print { display: none !important; }
  `;

  container.appendChild(style);
  container.appendChild(clone);
  document.body.appendChild(container);

  const opt = {
    margin: 10,
    filename: "Landingpage-Report.pdf",
    pagebreak: { mode: ["avoid-all","css","legacy"] },
    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
      windowWidth: container.scrollWidth || 1200,
      windowHeight: container.scrollHeight || 2000,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  h2p().set(opt).from(container).save().finally(()=>{
    document.body.removeChild(container);
  });
}


/**
 * Stabiler PDF-Export über verstecktes IFRAME:
 * - kopiert den Report-Knoten in ein Iframe
 * - fügt minimales A4-Print-CSS ein
 * - wartet auf Fonts/Images
 * - triggert print()
 */
function exportReportViaIframePrint() {
  if (typeof window === "undefined") return;
  const source = document.getElementById("report-root") as HTMLElement | null;
  if(!source) return;

  // Iframe vorbereiten
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const css = `
    @page { size: A4; margin: 10mm; }
    @media print {
      html, body { height: auto; }
      .export-a4 { width: 210mm; min-height: 297mm; }
      .no-print { display: none !important; }
      .card, .chart, .grid, .section { break-inside: avoid; page-break-inside: avoid; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    :root { --accent: #ff6e00; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, "Noto Sans"; background: #fff; color: #000; }
    .export-a4 h1, .export-a4 h2, .export-a4 h3, .export-a4 h4 { margin: 0 0 8px; }
    .export-a4 .score-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .export-a4 .score-card { border:1px solid #ddd; border-radius:8px; padding:12px; }
    .export-a4 .bar { height:10px; background:#eee; border-radius:8px; overflow:hidden; margin:8px 0; }
    .export-a4 .bar span { display:block; height:100%; background: var(--accent); }
    .muted { color: #333; }
  `;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if(!doc) return;

  doc.open();
  doc.write(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Landingpage-Report</title>
      <style>${css}</style>
    </head>
    <body>
      <main class="export-a4"></main>
    </body>
  </html>`);
  doc.close();

  // Knoten klonen (ohne Refs/Events)
  const target = doc.querySelector("main.export-a4") as HTMLElement;
  if(!target) return;
  const clone = source.cloneNode(true) as HTMLElement;
  target.appendChild(clone);

  // Bilder laden + Fonts warten, dann drucken
  const images = Array.from(target.querySelectorAll("img"));
  const imagePromises = images.map(img => {
    if (img.complete) return Promise.resolve(true);
    return new Promise(res => {
      img.addEventListener("load", () => res(true));
      img.addEventListener("error", () => res(true));
    });
  });

  const fontsReady = (doc as any).fonts?.ready ? (doc as any).fonts.ready : Promise.resolve();

  Promise.all([Promise.all(imagePromises), fontsReady]).then(()=>{
    // kleiner Delay für Layout
    setTimeout(()=>{
      (iframe.contentWindow as any).focus();
      (iframe.contentWindow as any).print();
      setTimeout(()=> document.body.removeChild(iframe), 1000);
    }, 200);
  });
}


/**
 * PDF-Export über Browser-Print (einzige Datei, keine Abhängigkeiten).
 * Klont den Report-Knoten in ein Blanko-Fenster (A4), setzt minimale Styles und triggert print().
 */
function exportReportViaPrintA4() {
  if (typeof window === "undefined") return;
  const node = document.getElementById("report-root") as HTMLElement | null;
  if(!node) return;
  const w = window.open("", "report_print", "width=900,height=1200");
  if(!w) return;

  const css = `
    @page { size: A4; margin: 10mm; }
    @media print {
      html, body { height: auto; }
      .export-a4 { width: 210mm; min-height: 297mm; }
      .card, .chart, .grid, .section { break-inside: avoid; page-break-inside: avoid; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji"; background: #fff; color: #000; }
    .export-a4 h1, .export-a4 h2, .export-a4 h3, .export-a4 h4 { margin: 0 0 8px; }
    .export-a4 .score-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .export-a4 .score-card { border:1px solid #ddd; border-radius:8px; padding:12px; }
    .export-a4 .bar { height:10px; background:#eee; border-radius:8px; overflow:hidden; margin:8px 0; }
    .export-a4 .bar span { display:block; height:100%; background:#ff6e00; }
    .export-a4 ul { margin:6px 0 0 18px; }
  `;

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Landingpage-Report</title>
      <style>${css}</style>
    </head>
    <body>
      <main class="export-a4">${node.outerHTML}</main>
    </body>
  </html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
  // Warten bis Fonts/Styles gerendert sind
  setTimeout(()=>{ w.focus(); w.print(); w.close(); }, 300);
}


/**
 * PDF-Export (html2pdf-only): nutzt ausschließlich das bereits via <Script> geladene Bundle.
 * Keine zusätzlichen Imports/Dependencies -> verhindert Build-Fehler.
 */
function exportNodeToPDF_html2pdfOnly(node: HTMLElement, fileName = "Landingpage-Report.pdf"){
  const h2p = (typeof window !== "undefined" && (window as any).html2pdf) || null;
  if(!h2p || !node) return;
  const opt = {
    margin: 10,
    filename: fileName,
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: node.scrollWidth, windowHeight: node.scrollHeight },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  h2p().set(opt).from(node).save();
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

  async function analyze(){
    if(!url) return;
    setLoading(true); setData(null);
    try{
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`API error: ${res.status}`);
      const j = await res.json();
      setData(j);
    }catch(e:any){ alert(e?.message || "Failed to analyze"); }
    finally{ setLoading(false); }
  }

  function exportFeedbackCSV(vote:'up'|'down'){
    if(!data) return;
    const row = [
      new Date().toISOString(),
      url,
      Math.round(data.scores.overall),
      Math.round(data.scores.bofu),
      Math.round(data.scores.convincing),
      Math.round(data.scores.technical),
      vote
    ].join(',');
    const csv = 'timestamp,url,overall,bofu,convincing,technical,vote\n' + row + '\n';
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lp-checker-feedback.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
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
            onClick={()=>{
              if(typeof window !== "undefined"){
                const node = document.querySelector(".card.exec") as HTMLElement | null;
                if(node) if (typeof window === "undefined") return;
  const nodeEl = document.getElementById("report-root") as HTMLElement | null;
  const h2p = (window as any).html2pdf;
  if (!nodeEl || !h2p) return;
  const prevWidth = nodeEl.style.width;
  const prevMaxWidth = nodeEl.style.maxWidth;
  nodeEl.style.width = "210mm";
  nodeEl.style.maxWidth = "210mm";
  const opt = {
    margin: 10,
    filename: "Landingpage-Report.pdf",
    pagebreak: { mode: ["avoid-all","css","legacy"] },
    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
      windowWidth: nodeEl.scrollWidth || 1200,
      windowHeight: nodeEl.scrollHeight || 2000,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };
  h2p().set(opt).from(nodeEl).save().finally(()=>{
    nodeEl.style.width = prevWidth;
    nodeEl.style.maxWidth = prevMaxWidth;
  });
              }
            }}
          >
            Export as PDF
          </button>
        </div>

        {url && (
          <div style={{marginTop:8, fontSize:12}}>
            URL: <a href={url} target="_blank" rel="noopener" style={{color:"#ffffff"}}>{shorten(url,72)}</a>
          </div>
        )}
      </section>

      <section className="card exec" id="report-root">
        <details className="checklist" open>
          <summary>Landing Page Essentials (Checklist)</summary>
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
        </details>

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
              <h4>Overall <sup><small><abbr title="Weighted combination: 40% BoFu, 30% Convincing, 30% Technical.">info</abbr></small></sup></h4>
              <div className="bar">
                <span className={scoreClass(data.scores.overall)} style={{width:`${Math.round(data.scores.overall)}%`}}/>
              </div>
              <small><Qual score={data.scores.overall}/></small>
            </div>

            <div className="score-card">
              <h4>Purchase / BoFu <sup><small><abbr title="Conversion path: form/CTA, direct contact options, pricing signals.">info</abbr></small></sup></h4>
              <div className="bar">
                <span className={scoreClass(data.scores.bofu)} style={{width:`${Math.round(data.scores.bofu)}%`}}/>
              </div>
              <small><Qual score={data.scores.bofu}/></small>
            </div>

            <div className="score-card">
              <h4>Convincing <sup><small><abbr title="Trust signals: testimonials, case studies, certifications; outcome evidence.">info</abbr></small></sup></h4>
              <div className="bar">
                <span className={scoreClass(data.scores.convincing)} style={{width:`${Math.round(data.scores.convincing)}%`}}/>
              </div>
              <small><Qual score={data.scores.convincing}/></small>
            </div>

            <div className="score-card">
              <h4>Technical <sup><small><abbr title="Basic hygiene: title, meta description, H1, canonical, HTTPS.">info</abbr></small></sup></h4>
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

          {/* Hidden thumbs-only feedback; downloads a CSV row. */}
          <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'center', marginTop:10, opacity:0.5}}>
            <button className="btn-secondary" onClick={()=>exportFeedbackCSV('up')}>👍</button>
            <button className="btn-secondary" onClick={()=>exportFeedbackCSV('down')}>👎</button>
          </div>
        </>)}
      </section>

      <footer className="footer">
        © Tim Clausen 2025 — This tool targets SEA/BoFu landing pages, not general websites.
      </footer>

      <Script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js" strategy="afterInteractive" />
    </main>
  );
}
