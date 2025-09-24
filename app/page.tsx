'use client';
import { useState } from "react";
import Script from "next/script";

type Result = {
  scores: { overall:number; bofu:number; convincing:number; technical:number; },
  mgmt?: string,
  positives?: string[],
  improvements?: string[]
};

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
  return u.slice(0, Math.floor(max*0.6)) + "…" + u.slice(-Math.floor(max*0.3));
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

  return (
    <main className="container">
      <section className="hero card">
        <h1>Bottom of Funnel (BoFu) Landing Page Checker</h1>
        <p className="sub">
          Focus: BOFU (CTA, form/contact, pricing) + Convincing (benefits, trust, objections, visuals).
          Technical is a basic hygiene light-check. Export as PDF available.
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
                if(node) (window as any).html2pdf?.().from(node).save("lp-checker.pdf");
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

      <section className="card exec">
        <details className="checklist" open>
          <summary>Landing Page Essentials (Checklist)</summary>
          {/* deine bestehende Checklist bleibt hier */}
        </details>

        {data && (<>
          <div className="exec">
            <div className="exec-title">Executive summary</div>
            <small className="muted">
              Overall score: <b>{Math.round(data.scores.overall)}</b>/100 — <Qual score={data.scores.overall}/>
            </small>
            {data.mgmt && <div className="exec-text" style={{marginTop:6}}>{data.mgmt}</div>}
          </div>

          <div className="score-grid">
            <div className="score-card">
              <h4>Overall</h4>
              <div className="bar">
                <span className={scoreClass(data.scores.overall)} style={{width:`${Math.round(data.scores.overall)}%`}}/>
              </div>
              <small><Qual score={data.scores.overall}/></small>
            </div>

            <div className="score-card">
              <h4>Purchase / BoFu</h4>
              <div className="bar">
                <span className={scoreClass(data.scores.bofu)} style={{width:`${Math.round(data.scores.bofu)}%`}}/>
              </div>
              <small><Qual score={data.scores.bofu}/></small>
            </div>

            <div className="score-card">
              <h4>Convincing</h4>
              <div className="bar">
                <span className={scoreClass(data.scores.convincing)} style={{width:`${Math.round(data.scores.convincing)}%`}}/>
              </div>
              <small><Qual score={data.scores.convincing}/></small>
            </div>

            <div className="score-card">
              <h4>Technical</h4>
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

      <Script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js" strategy="afterInteractive" />
    </main>
  );
}
