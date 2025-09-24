"use client";

import { useState } from "react";
import Script from "next/script";

type Scores = { overall:number; bofu:number; convincing:number; technical:number };
type Result = {
  scores: Scores;
  positives: string[];
  improvements: string[];
  summary?: string;
};

function Qual({score}:{score:number}){
  const s = Math.round(score);
  const label = s>=80?'Excellent': s>=60?'Good': s>=40?'Fair': s>=20?'Poor':'Very poor';
  return <>{label}</>;
}

export default function Page(){
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Result|null>(null);
  const [fbMsg, setFbMsg] = useState("");

  async function analyze(){
    if(!url) return;
    setLoading(true);
    setData(null);
    setFbMsg("");
    try{
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`API error: ${res.status}`);
      const j = await res.json();
      setData(j);
    }catch(e:any){
      alert(e.message || "Failed to analyze");
    }finally{
      setLoading(false);
    }
  }

  async function sendFeedback(vote:"up"|"down"){
    if(!data) return;
    setFbMsg("Sende Feedback...");
    try{
      const res = await fetch("/api/feedback",{
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify({
          url, scores: data.scores, positives: data.positives, improvements: data.improvements, vote, ts: Date.now()
        })
      });
      if(!res.ok) throw new Error("Feedback failed");
      setFbMsg("Danke!");
    }catch{
      setFbMsg("Feedback konnte nicht gespeichert werden (no-op).");
    }
  }

  return (
    <main className="container">
      <section className="hero card">
        <h1>Bottom of Funnel (BoFu) Landingpage Checker</h1>
        <p className="sub">
          Fokus: BOFU (CTA, Form/Kontakt, Pricing) + Convincing (Benefits, Trust, Objections, Visuals).
          Technical ist ein <b>Basic‑Hygiene‑Light‑Check</b>. Export als PDF möglich.
        </p>
        <div className="row">
          <input id="targetUrl" type="url" placeholder="https://example.com/your-landingpage" value={url} onChange={e=>setUrl(e.target.value)} />
          <button id="analyzeBtn" className="btn-primary" onClick={analyze} disabled={loading || !url}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
          <button id="exportPdfBtn" className="btn-secondary" onClick={()=>{
            const element = document.querySelector(".report") as HTMLElement | null;
            if (!element) return;
            // @ts-ignore
            window.html2pdf().set({ margin:10, filename:"bofu-landingpage-report.pdf", image:{type:"jpeg",quality:0.95}, html2canvas:{scale:2}, jsPDF:{unit:"mm",format:"a4",orientation:"portrait"} }).from(element).save();
          }}>Export as PDF</button>
        </div>
        <details className="checklist">
          <summary>Landingpage Essentials (Checklist)</summary>
          <ul>
            <li>Klarer Primary CTA above the fold</li>
            <li>Kurzes Lead-Formular oder direkter Kontaktweg</li>
            <li>Nutzenorientierter Text + belastbare Belege/Trust</li>
            <li>Einwandbehandlung (FAQs, Garantien, Transparenz bei Pricing)</li>
            <li>Mobile Basics + SEO-Basics: HTTPS, canonical, Title, Meta</li>
          </ul>
        </details>
      </section>

      <section id="report" className="card report" hidden={!data}>
        {data && (
          <>
            <div id="summary">
              <div className="exec">
                <div className="exec-title">Executive summary</div>
                <div className="exec-text">
                  Overall score: <b>{Math.round(data.scores.overall)}</b>/100 — <Qual score={data.scores.overall}/> <br/>
                  URL: <a href={url} target="_blank" rel="noopener">{url}</a>
                </div>
                {data.summary && <div className="exec-text" style={{marginTop:4}}>{data.summary}</div>}
              </div>
            </div>

            <div className="score-grid">
              <div className="score-card">
                <h4 className="has-tip" data-tip="Overall kombiniert BoFu (CTA, Form/Kontakt, Pricing), Convincing (Benefits, Trust, Objections, Visuals) und Technical Basics. 'Excellent' nur bei vollständiger Abdeckung.">Overall</h4>
                <div className="bar"><span id="score-overall" style={{width:`${Math.max(0, Math.min(100, Math.round(data.scores.overall))) }%`}}/></div>
                <small id="qual-overall"><Qual score={data.scores.overall}/></small>
              </div>
              <div className="score-card">
                <h4 className="has-tip" data-tip="BoFu: klarer CTA, kurzer Lead-Pfad (Form/Kontakt), Pricing-Klarheit.">Purchase / BOFU</h4>
                <div className="bar"><span id="score-bofu" style={{width:`${Math.max(0, Math.min(100, Math.round(data.scores.bofu))) }%`}}/></div>
                <small id="qual-bofu"><Qual score={data.scores.bofu}/></small>
              </div>
              <div className="score-card">
                <h4 className="has-tip" data-tip="Convincing: Nutzenargumente, Trust (Testimonials/Logos/Ratings), Einwandbehandlung (FAQs/Policies), Visuals.">Convincing</h4>
                <div className="bar"><span id="score-convincing" style={{width:`${Math.max(0, Math.min(100, Math.round(data.scores.convincing))) }%`}}/></div>
                <small id="qual-convincing"><Qual score={data.scores.convincing}/></small>
              </div>
              <div className="score-card">
                <h4 className="has-tip" data-tip="Technical (light): nur HTML-Basics (HTTPS, <title>, Meta Description, H1, Viewport, Canonical, Alt-Texte). Keine Tracking/Core Web Vitals.">
                  Technical <small style={{fontWeight:400,opacity:.75}}>(basic hygiene — light check)</small>
                </h4>
                <div className="bar"><span id="score-technical" style={{width:`${Math.max(0, Math.min(100, Math.round(data.scores.technical))) }%`}}/></div>
                <small id="qual-technical"><Qual score={data.scores.technical}/></small>
              </div>
            </div>

            <p className="note">Disclaimer: Dieser Checker parst nur statisches HTML. Kein Tracking, keine Core Web Vitals, kein gerendertes JS.</p>

            <div className="two-col">
              <div>
                <h4>What works</h4>
                <ul id="positives">{(data.positives||[]).map((t,i)=>(<li key={i}>{t}</li>))}</ul>
              </div>
              <div>
                <h4>Improvements</h4>
                <ul id="improvements">{(data.improvements||[]).map((t,i)=>(<li key={i}>{t}</li>))}</ul>
              </div>
            </div>

            <div className="feedback">
              <span>Passt die Bewertung?</span>
              <button id="fbUp" className="btn-secondary" onClick={()=>sendFeedback("up")}>👍</button>
              <button id="fbDown" className="btn-secondary" onClick={()=>sendFeedback("down")}>👎</button>
              <span id="fbStatus" className="muted">{fbMsg}</span>
            </div>
          </>
        )}
      </section>

      <footer className="footer">© Tim Clausen 2025 — This tool targets SEA/BoFu landing pages, not general websites.</footer>

      <Script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js" strategy="afterInteractive" />
    </main>
  );
}
