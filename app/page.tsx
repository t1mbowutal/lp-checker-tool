"use client";

import { useState } from "react";
import Script from "next/script";

type Scores = { overall:number; bofu:number; convincing:number; technical:number };
type Result = { scores: Scores; positives: string[]; improvements: string[]; summary?: string };

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
    setLoading(true); setData(null); setFbMsg("");
    try{
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
      if(!res.ok) throw new Error(`API error: ${res.status}`);
      const j = await res.json();
      setData(j);
    }catch(e:any){ alert(e.message || "Failed to analyze"); }
    finally{ setLoading(false); }
  }

  async function sendFeedback(vote:"up"|"down"){
    if(!data) return;
    setFbMsg("Saving feedback...");
    try{
      const res = await fetch("/api/feedback",{
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify({
          url, vote, scores: data.scores, positives: data.positives, improvements: data.improvements, ts: Date.now(), csv: true
        })
      });
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")){
        const j = await res.json();
        if (j.csv) {
          const blob = new Blob([j.csv], {type:"text/csv;charset=utf-8"});
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "lp-feedback.csv";
          a.click();
          URL.revokeObjectURL(a.href);
        }
      }
      setFbMsg("Thanks!");
    }catch{ setFbMsg("Could not save feedback (fallback CSV download only)."); }
  }

  return (
    <main className="container">
      <section className="hero card">
        <h1>Bottom of Funnel (BoFu) Landing Page Checker</h1>
        <p className="sub">
          Focus: BOFU (CTA, form/contact, pricing) + Convincing (benefits, trust, objections, visuals). Technical is a <b>basic hygiene light‑check</b>. Export as PDF available.
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
                URL: <a href={url} target="_blank" rel="noopener">{url}</a>
              </div>
              {data.summary && <div className="exec-text" style={{marginTop:4}}>{data.summary}</div>}
            </div>

            <div className="score-grid">
              <div className="score-card">
                <h4 className="has-tip" data-tip={"Overall blends: 50% BoFu, 35% Convincing, 15% Technical.\nHard caps apply if key pillars are missing."}>Overall</h4>
                <div className="bar"><span style={{width:`${Math.round(data.scores.overall)}%`}}/></div>
                <small><Qual score={data.scores.overall}/></small>
              </div>
              <div className="score-card">
                <h4 className="has-tip" data-tip={"BoFu checks: presence & clarity of primary CTA, lead path (form/contact), pricing clarity.\nMissing CTA/lead/pricing enforces caps."}>Purchase / BoFu</h4>
                <div className="bar"><span style={{width:`${Math.round(data.scores.bofu)}%`}}/></div>
                <small><Qual score={data.scores.bofu}/></small>
              </div>
              <div className="score-card">
                <h4 className="has-tip" data-tip={"Convincing checks: benefits/outcomes, trust (testimonials/cases/ratings), objection handling (FAQs/policies), meaningful visuals."}>Convincing</h4>
                <div className="bar"><span style={{width:`${Math.round(data.scores.convincing)}%`}}/></div>
                <small><Qual score={data.scores.convincing}/></small>
              </div>
              <div className="score-card">
                <h4 className="has-tip" data-tip={"Technical (light) checks: HTTPS, <title>, meta description, H1, viewport, canonical, basic image alts."}>Technical <small style={{fontWeight:400,opacity:.75}}>(basic hygiene — light check)</small></h4>
                <div className="bar"><span style={{width:`${Math.round(data.scores.technical)}%`}}/></div>
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

            <div className="feedback">
              <span>Does this rating look right?</span>
              <button className="btn-secondary" onClick={()=>sendFeedback("up")}>👍</button>
              <button className="btn-secondary" onClick={()=>sendFeedback("down")}>👎</button>
              <span className="muted">{fbMsg}</span>
            </div>
          </>
        )}
      </section>

      <footer className="footer">© Tim Clausen 2025 — This tool targets SEA/BoFu landing pages, not general websites.</footer>

      <Script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js" strategy="afterInteractive" />
    </main>
  );
}
