"use client";

import { useState } from "react";
import Script from "next/script";

type Scores = { overall:number; bofu:number; convincing:number; technical:number };
type Result = { scores: Scores; positives: string[]; improvements: string[]; summary?: string; mgmt?: string };

function Qual({score}:{score:number}){
  const s = Math.round(score);
  const label = s>=80?'Excellent': s>=60?'Good': s>=40?'Fair': s>=20?'Poor':'Very poor';
  return <>{label}</>;
}

function shorten(u:string, max=72){
  if(!u) return "";
  if(u.length<=max) return u;
  const head = u.slice(0, Math.floor(max*0.6));
  const tail = u.slice(-Math.floor(max*0.3));
  return head + "…"+ tail;
}
export default function Page(){
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Result|null>(null);
  

  async function analyze(){
    if(!url) return;
    setLoading(true); setData(null);
    try{
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`API error: ${res.status}`);
      const j = await res.json();
      setData(j);
    }catch(e:any){ alert(e.message || "Failed to analyze"); }
    finally{ setLoading(false); }
  }

    return (
    <main className="container">
      <section className="hero card">
        <h1>Bottom of Funnel (BoFu) Landing Page Checker</h1>
        <p className="sub">
          Focus: BOFU (CTA, form/contact, pricing) + Convincing (benefits, trust, objections, visuals). Technical is a basic hygiene light‑check. Export as PDF available.
        </p>
        <div className="row">
          <input type="url" placeholder="https://example.com/your-landing-page" value={url} onChange={e=>setUrl(e.target.value)} />
          <button className="btn-primary" onClick={analyze} disabled={loading || !url}>{loading ? "Analyzing..." : "Analyze"}</button>
          <button className="btn-secondary" onClick={()=>{
            const el = document.querySelector(".report") as HTMLElement | null;
            if (!el) return;
            // @ts-ignore
            window.html2pdf().set({ margin:10, filename:"bofu-landingpage-report.pdf", image:{type:"jpeg",quality:0.95}, html2canvas:{scale:2}, jsPDF:{unit:"mm",format:"a4",orientation:"portrait"} }).from(el).save();
          }}>Export as PDF</button>
        </div>
        <details className="checklist">
          <summary>Landing Page Essentials (Checklist)</summary>
          <ul>
            <li>Clear primary CTA above the fold</li>
            <li>Short lead form or direct contact route</li>
            <li>Benefit-led copy + credible proof</li>
            <li>Objection handling (FAQs, guarantees, transparent pricing)</li>
            <li>Mobile basics + SEO basics: HTTPS, canonical, title, meta</li>
          </ul>
        </details>
      </section>

      <section className="card report" hidden={!data}>
        {data && (
          <>
            <div className="exec">
              <div className="exec-title">Executive summary</div>
              <div className="exec-text">
                Overall score: <b>{Math.round(data.scores.overall)}</b>/100 — <Qual score={data.scores.overall}/> <br/>
                URL: <a style={{color:"#ffffff"}} href={url} target="_blank" rel="noopener">{shorten(url)}</a>
              </div>
              {data.mgmt && <div className="exec-text" style={{marginTop:6}}>{data.mgmt}</div>}
            </div>

            <div className="score-grid">
              <div className="score-card">
                <h4 className="tip">Overall <span className="tip-icon">i</span>
                  <span className="tip-bubble">Weighting: 50% BoFu, 35% Convincing, 15% Technical. Hard caps if key pillars are missing.</span>
                </h4>
                <div className="bar"><span style={width:`${Math.round(data.scores.overall)}%`, backgroundColor: (Math.round(data.scores.overall)>=67? "#166534": Math.round(data.scores.overall)>=34? "#b45309":"#991b1b")}/></div>
                <small><Qual score={data.scores.overall}/></small>
              </div>
              <div className="score-card">
                <h4 className="tip">Purchase / BoFu <span className="tip-icon">i</span>
                  <span className="tip-bubble">Checks: clear primary CTA, lead path (form/contact), pricing clarity. Missing CTA/lead/pricing enforces caps.</span>
                </h4>
                <div className="bar"><span style={width:`${Math.round(data.scores.bofu)}%`, backgroundColor: (Math.round(data.scores.bofu)>=67? "#166534": Math.round(data.scores.bofu)>=34? "#b45309":"#991b1b")}/></div>
                <small><Qual score={data.scores.bofu}/></small>
              </div>
              <div className="score-card">
                <h4 className="tip">Convincing <span className="tip-icon">i</span>
                  <span className="tip-bubble">Checks: benefits/outcomes, trust (testimonials/cases/ratings), objections (FAQs/policies), meaningful visuals.</span>
                </h4>
                <div className="bar"><span style={width:`${Math.round(data.scores.convincing)}%`, backgroundColor: (Math.round(data.scores.convincing)>=67? "#166534": Math.round(data.scores.convincing)>=34? "#b45309":"#991b1b")}/></div>
                <small><Qual score={data.scores.convincing}/></small>
              </div>
              <div className="score-card">
                <h4 className="tip">Technical <span className="tip-icon">i</span>
                  <span className="tip-bubble">Light HTML basics: HTTPS, &lt;title&gt;, meta description, H1, viewport, canonical, basic image alts.</span>
                </h4>
                <div className="bar"><span style={width:`${Math.round(data.scores.technical)}%`, backgroundColor: (Math.round(data.scores.technical)>=67? "#166534": Math.round(data.scores.technical)>=34? "#b45309":"#991b1b")}/></div>
                <small><Qual score={data.scores.technical}/></small>
              </div>
            </div>

            <p className="note">Disclaimer: This checker parses static HTML only. No tracking, Core Web Vitals, or client‑rendered JS.</p>

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
</>
        )}
      </section>

      <footer className="footer">© Tim Clausen 2025 — This tool targets SEA/BoFu landing pages, not general websites.</footer>

      <Script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js" strategy="afterInteractive" />
    </main>
  );
}
