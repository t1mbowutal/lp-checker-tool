'use client';
import { useState } from "react";
import Script from "next/script";

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
  if (s>=67) return "high";
  if (s>=34) return "med";
  return "low";
}

export default function Page(){
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Result|null>(null);

  async function analyze(){
    if(!url) return;
    setLoading(true);
    setData(null);
    try{
      const res = await fetch("/api/analyze", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ url })
      });
      const j = await res.json();
      setData(j);
    }catch(e:any){
      alert(e?.message || "Analyze failed");
    }finally{
      setLoading(false);
    }
  }

  function shorten(u:string, max=72){
    try{
      const out = u.replace(/^https?:\/\//,"");
      return out.length>max ? out.slice(0,max-1)+"…" : out;
    }catch{
      return u;
    }
  }

  function exportPDF(){
    const node = document.querySelector('main');
    const opt = {
      margin:       10,
      pagebreak:    { mode: ['avoid-all','css','legacy'] as any },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    } as any;
    (window as any).html2pdf().set(opt).from(node).save('lp-checker.pdf');
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
          This tool evaluates SEA/BoFu landing pages for structure, clarity, and conversion potential.
          It does not measure real traffic, tracking, Core Web Vitals, or live campaign performance.
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
          <button className="btn-secondary" onClick={exportPDF}>Export as PDF</button>
        </div>

        {url && (
          <div className="url-line">
            URL: <a href={url} target="_blank" rel="noopener" style={{color:"#ffffff"}}>{shorten(url,72)}</a>
          </div>
        )}
      </section>

      <section className="card exec">
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
          <div className="exec" style={{marginBottom:12}}>
            <div className="exec-title" style={{fontSize:"1.75rem", fontWeight:800, display:"block"}}>Executive Summary</div>
            <div className="muted" style={{color:"#ff6e00", fontWeight:800, fontSize:"1.125rem", margin:"4px 0 10px", display:"block"}}>
              Overall score: <b>{Math.round(data.scores.overall)}</b>/100 — <Qual score={data.scores.overall}/>
            </div>
            {data.mgmt && <div className="exec-text" style={{marginTop:6}}>{data.mgmt}</div>}
          </div>

          <div className="score-grid">
            <div className="score-card">
              <h4>Overall <sup><span className="info">info</span></sup></h4>
              <div className={`bar ${scoreClass(data.scores.overall)}`}>
                <div className="fill" style={{width:`${Math.round(data.scores.overall)}%`}}></div>
              </div>
              <div className="muted"><Qual score={data.scores.overall}/></div>
            </div>

            <div className="score-card">
              <h4>Purchase / BoFu <sup><span className="info">info</span></sup></h4>
              <div className={`bar ${scoreClass(data.scores.bofu)}`}>
                <div className="fill" style={{width:`${Math.round(data.scores.bofu)}%`}}></div>
              </div>
              <div className="muted"><Qual score={data.scores.bofu}/></div>
            </div>

            <div className="score-card">
              <h4>Convincing <sup><span className="info">info</span></sup></h4>
              <div className={`bar ${scoreClass(data.scores.convincing)}`}>
                <div className="fill" style={{width:`${Math.round(data.scores.convincing)}%`}}></div>
              </div>
              <div className="muted"><Qual score={data.scores.convincing}/></div>
            </div>

            <div className="score-card">
              <h4>Technical <sup><span className="info">info</span></sup></h4>
              <div className={`bar ${scoreClass(data.scores.technical)}`}>
                <div className="fill" style={{width:`${Math.round(data.scores.technical)}%`}}></div>
              </div>
              <div className="muted"><Qual score={data.scores.technical}/></div>
            </div>
          </div>

          <div className="muted" style={{marginTop:12}}>
            Disclaimer: This checker parses static HTML only. No tracking, Core Web Vitals, or client-rendered JS.
          </div>

          <div className="grid two mt">
            <div>
              <h3>What works</h3>
              <ul className="bullets">
                {(data.positives||[]).map((x,i)=>(<li key={i}>{x}</li>))}
              </ul>
            </div>
            <div>
              <h3>Improvements</h3>
              <ul className="bullets">
                {(data.improvements||[]).map((x,i)=>(<li key={i}>{x}</li>))}
              </ul>
            </div>
          </div>

          <div className="thumbs">
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
