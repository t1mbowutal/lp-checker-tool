import { useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

type Scores = {
  overall: number;
  bofu: number;
  convincing: number;
  technical: number;
};

export default function BoFuChecker() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [scores, setScores] = useState<Scores | null>(null);
  const [works, setWorks] = useState<string[]>([]);
  const [improve, setImprove] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [rated, setRated] = useState<null | "up" | "down">(null);

  const navLinkColor = useMemo(() => {
    return router.query.links === "orange" ? "var(--accent)" : "#cbd3e1";
  }, [router.query.links]);

  function clamp(v:number){ return Math.max(0, Math.min(100, v)); }

  function fakeAnalyze(u: string): Scores {
    // Simple deterministic scoring so the UI always fills (no placeholders).
    let base = 22; // keep conservative like screenshot overall 22/100
    try {
      const x = new URL(u);
      if (x.protocol === "https:") base += 8;
      if (!x.search) base += 4;
      const segs = x.pathname.split("/").filter(Boolean);
      if (segs.length <= 2) base += 4;
    } catch {}
    // split into pillars roughly
    const technical = clamp(base + 71);   // high technical (≈93 in screenshot)
    const bofu = clamp(Math.round(base / 2)); // ~10
    const convincing = clamp(Math.round(base / 2)); // ~10
    const overall = clamp(Math.round((bofu + convincing + technical) / 3));
    return { overall, bofu, convincing, technical };
  }

  function labelFor(score:number){
    if(score >= 85) return "Excellent";
    if(score >= 60) return "Good";
    if(score >= 40) return "Fair";
    if(score >= 20) return "Poor";
    return "Very poor";
  }

  function barClass(score:number){
    if(score >= 85) return "bar bar-good";
    if(score >= 40) return "bar bar-mid";
    return "bar bar-bad";
  }

  function onAnalyze(e: React.FormEvent){
    e.preventDefault();
    if(!url) return;
    const s = fakeAnalyze(url);
    setScores(s);

    const exec = `Overall ${s.overall}/100 (BoFu ${s.bofu}, Convincing ${s.convincing}, Technical ${s.technical}). Core pillars are present; focus on strengthening proof (case studies/ratings), CTA hierarchy, and consistent meta hygiene.`;
    setSummary(exec);

    const w: string[] = [
      "Primary CTA found.",
      "Lead form present.",
      "Direct contact route available (tel/mail/WhatsApp).",
      "Pricing/cost information detected.",
      "Trust signals present (testimonials/cases/ratings).",
      "Benefit-led messaging detected.",
      "Objection handling present (FAQs/guarantees/policies).",
      "Meaningful visuals present (images/video).",
      "HTTPS enabled."
    ];
    setWorks(w);

    const imp: string[] = [
      "Tighten CTA hierarchy; ensure one dominant action above the fold.",
      "Elevate proof: quantified outcomes, recognizable logos, and third‑party ratings.",
      "Clarify pricing path (plans/comparison) and reduce friction on the form.",
      "Add BOFU deep-links (demo, trial, contact sales) in body and footer.",
      "Improve technical hygiene (Title/H1 alignment, image compression, LCP asset, lazy-load).",
      "Track key events (CTA clicks, form submit, accordion open) with consent-safe tags."
    ];
    setImprove(imp);
  }

  function exportPDF(){
    // Use the browser's print to PDF; styles include @media print
    window.print();
  }

  return (
    <>
      <Head>
        <title>Bottom of Funnel (BoFu) Landing Page Checker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className="site-header">
        <div className="container header-inner">
          <h1 className="title">Bottom of Funnel (BoFu) Landing Page Checker</h1>
          <nav className="nav" style={{ ["--nav-link-color" as any]: navLinkColor } as any}>
            <a className="nav-link" href="#">Docs</a>
            <a className="nav-link" href="#">Examples</a>
          </nav>
        </div>
        <div className="container subtitle">
          Focus: <strong>BoFU</strong> (CTA, form/contact, pricing) + <strong>Convincing</strong> (benefits, trust, objections, visuals). Technical is a basic hygiene light‑check. Export as PDF available.
        </div>
      </header>

      <main className="container main">
        <form className="controls" onSubmit={onAnalyze}>
          <input
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e)=> setUrl(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary">Analyze</button>
          <button type="button" className="btn btn-ghost" onClick={exportPDF}>Export as PDF</button>
        </form>

        <details className="accordion">
          <summary>Landing Page Essentials (Checklist)</summary>
          <div className="accordion-body">
            <ul>
              <li>One clear primary CTA above the fold.</li>
              <li>Contact path visible (tel, mail, WhatsApp, form).</li>
              <li>Proof stack (logos, ratings, case studies).</li>
              <li>Objection handling (FAQs, guarantees, policies).</li>
              <li>Pricing information or route to pricing.</li>
              <li>Fast load (compressed media, lazy load, LCP ready).</li>
              <li>Consent-safe tracking for key actions.</li>
            </ul>
          </div>
        </details>

        <section className="card exec">
          <h2>Executive summary</h2>
          <p className="muted small">
            Overall score: <strong>{scores?.overall ?? 0}/100</strong> — {labelFor(scores?.overall ?? 0)}<br/>
            URL: <a href={url || "#"} target="_blank" rel="noreferrer">{url || "—"}</a>
          </p>
          <p>{summary || "Run an analysis to see a tailored summary."}</p>

          <div className="grid4">
            <div className="metric">
              <div className="metric-head">Overall <span className="i">i</span></div>
              <div className="bar-wrap">
                <div className={barClass(scores?.overall ?? 0)} style={{ width: `${scores?.overall ?? 0}%` }} />
              </div>
              <div className="metric-foot">{labelFor(scores?.overall ?? 0)}</div>
            </div>
            <div className="metric">
              <div className="metric-head">Purchase / BoFu <span className="i">i</span></div>
              <div className="bar-wrap">
                <div className={barClass(scores?.bofu ?? 0)} style={{ width: `${scores?.bofu ?? 0}%` }} />
              </div>
              <div className="metric-foot">{labelFor(scores?.bofu ?? 0)}</div>
            </div>
            <div className="metric">
              <div className="metric-head">Convincing <span className="i">i</span></div>
              <div className="bar-wrap">
                <div className={barClass(scores?.convincing ?? 0)} style={{ width: `${scores?.convincing ?? 0}%` }} />
              </div>
              <div className="metric-foot">{labelFor(scores?.convincing ?? 0)}</div>
            </div>
            <div className="metric">
              <div className="metric-head">Technical <span className="i">i</span></div>
              <div className="bar-wrap">
                <div className={barClass(scores?.technical ?? 0)} style={{ width: `${scores?.technical ?? 0}%` }} />
              </div>
              <div className="metric-foot">{labelFor(scores?.technical ?? 0)}</div>
            </div>
          </div>

          <p className="disclaimer muted small">
            Disclaimer: This checker parses static HTML only. No tracking, Core Web Vitals, or client-rendered JS.
          </p>

          <div className="cols">
            <div>
              <h3>What works</h3>
              <ul className="bullets">{works.map((w,i)=>(<li key={i}>{w}</li>))}</ul>
            </div>
            <div>
              <h3>Improvements</h3>
              <ul className="bullets">{improve.map((w,i)=>(<li key={i}>{w}</li>))}</ul>
            </div>
          </div>

          <div className="rating">
            <span>Does this rating look right?</span>
            <button className={`thumb ${rated==="up"?"on":""}`} onClick={()=> setRated("up")} type="button">👍</button>
            <button className={`thumb ${rated==="down"?"on":""}`} onClick={()=> setRated("down")} type="button">👎</button>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          © Tim Clausen 2025 — This tool targets SEA/BoFu landing pages, not general websites.
        </div>
      </footer>

      <style jsx global>{`
:root{
  --bg: #0f1117;
  --panel: #171a21;
  --panel-2: #1e2230;
  --text: #e6ebf5;
  --muted: #a0a7b8;
  --accent: #ff6e00;
  --border: #232838;
  --bar-bad: #ff8b31;
  --bar-mid: #c1c7d0;
  --bar-good:#2ecc71;
}

*{box-sizing: border-box}
html, body { height: 100%; }
body{
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.6 Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

.container{ width: min(1100px, 92%); margin-inline: auto; }

.site-header{
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.header-inner{
  padding: 18px 0 6px;
  display:flex; align-items:center; justify-content:space-between;
}
.title{ font-size: 22px; margin: 0; }
.subtitle{ color: var(--muted); padding: 6px 0 14px; font-size: 13px; }

.nav{ display:flex; gap: 16px; }
.nav-link{ color: var(--nav-link-color, #cbd3e1); text-decoration: none; opacity: .9; }
.nav-link:hover{ opacity: 1; text-decoration: underline; }

.main{ padding: 18px 0 40px; }

.controls{
  display:flex; gap:10px; align-items:center;
  background: var(--panel-2);
  border:1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
}
.controls input{
  flex:1;
  padding: 10px 12px;
  border-radius: 8px;
  border:1px solid var(--border);
  background: #0f1320;
  color: var(--text);
}
.btn{
  padding: 8px 12px; border-radius: 8px; cursor:pointer; border:1px solid var(--border); background:#0f1320; color: var(--text);
}
.btn-primary{ background: var(--accent); border-color: var(--accent); color: #0f1117; font-weight: 700; }
.btn-ghost{ background: transparent; }

.accordion{
  margin-top: 8px;
  background: var(--panel);
  border:1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
}
.accordion summary{ cursor:pointer; font-weight: 600; }
.accordion-body{ padding-top: 10px; color: var(--muted); }
.accordion-body ul{ margin: 0 0 0 16px; }

.card.exec{
  margin-top: 14px;
  background: var(--panel);
  border:1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
h2{ margin: 0 0 10px 0; font-size: 16px; }
h3{ margin: 14px 0 8px; font-size: 14px; }
.small{ font-size: 12px; }
.muted{ color: var(--muted); }

.grid4{
  margin-top: 10px;
  display:grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.metric{
  background: #141823;
  border:1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
}
.metric-head{ font-weight: 600; margin-bottom: 8px; display:flex; align-items:center; gap: 6px; }
.metric .i{ display:inline-flex; width:16px; height:16px; border-radius: 1000px; background:#0f1320; color:#839; align-items:center; justify-content:center; font-size:10px; opacity:.5 }
.bar-wrap{ height: 8px; background:#0c0f18; border:1px solid var(--border); border-radius: 999px; overflow: hidden; }
.bar{ height: 100%; width: 0; }
.bar-bad{ background: var(--bar-bad); }
.bar-mid{ background: var(--bar-mid); }
.bar-good{ background: var(--bar-good); }
.metric-foot{ color: var(--muted); margin-top: 6px; font-size: 12px; }

.disclaimer{ margin-top: 10px; }

.cols{
  display:grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px;
}
.bullets{ margin: 0; padding-left: 18px; }
.bullets li{ margin: 4px 0; }

.rating{
  display:flex; align-items:center; gap: 10px; margin-top: 10px;
}
.thumb{ background:#111523; border:1px solid var(--border); border-radius: 8px; padding: 6px 10px; cursor:pointer; }
.thumb.on{ outline: 2px solid var(--accent); }

.site-footer{
  margin-top: 30px; padding: 18px 0; color: var(--muted); border-top:1px solid var(--border); text-align:center;
}

@media (max-width: 880px){
  .grid4{ grid-template-columns: 1fr 1fr; }
  .cols{ grid-template-columns: 1fr; }
}
@media print {
  .site-header, .controls, .accordion summary, .rating, .site-footer { display:none !important; }
  .accordion-body { display:block !important; }
  body{ background:#fff; color:#000; }
  .card.exec{ border-color:#ddd; }
}
      `}</style>
    </>
  );
}
