import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function FallbackUI() {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [summary, setSummary] = useState<string>("Sobald ein Score vorliegt, erscheint hier 1–2 Sätze. Details stehen unten in Improvements.");
  const [improvements, setImprovements] = useState<string[]>(["Noch keine Analyse durchgeführt."]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [fbMsg, setFbMsg] = useState("");

  // nav link color via query ?links=orange
  const navLinkColor = useMemo(() => {
    return router && router.query.links === "orange" ? "var(--accent)" : "#ffffff";
  }, [router]);

  const urlInputRef = useRef<HTMLInputElement>(null);

  function computeFakeScore(url: string): number {
    let s = 70;
    try{
      const u = new URL(url);
      if(u.protocol === "https:") s += 10;
      if(u.searchParams.toString().length === 0) s += 5;
      const pathSegments = u.pathname.split("/").filter(Boolean);
      if(pathSegments.length <= 2) s += 5;
      if(u.hostname.includes("ifm")) s += 3;
    }catch{
      s = 50;
    }
    return Math.max(0, Math.min(100, s));
  }

  function colorClass(score: number){
    if(score >= 80) return "score-good";
    if(score >= 60) return "score-mid";
    return "score-bad";
  }

  function buildSummarySentence(score:number){
    if(score >= 80){
      return "Starkes Fundament: Die Seite ist überzeugend aufgestellt; Feinschliff bei BOFU-CTAs und technischer Hygiene zahlt sich aus.";
    }else if(score >= 60){
      return "Solide Basis mit klaren Hebeln: Mit besseren CTAs, klarerer Hierarchie und sauberem Tracking hebt die Seite spürbar ab.";
    }
    return "Hoher Hebel: Erst Struktur & Botschaft klären (Hero, Proof, CTA), dann Tracking & Ladezeit fixen – das dreht die Kurve.";
  }

  function buildImprovements(score:number){
    const items:string[] = [];
    if(score < 85) items.push("CTA-Dichte & Sichtbarkeit erhöhen (Above-the-Fold + Sticky Variante prüfen).");
    if(score < 80) items.push("Hero vereinfachen: 1 Kernbotschaft, 1 Visual, 1 primäre Conversion.");
    if(score < 75) items.push("Proof-Blöcke schärfen (Use-Cases, Logos, Zahlenbelege, Social Proof).");
    if(score < 70) items.push("Interne Verlinkung (BOFU) ergänzen: Vergleich, Preise, Demo/Trial, Ansprechpartner.");
    if(score < 65) items.push("Technische Hygiene: Title/H1-Kohärenz, LCP-Asset, Bildkomprimierung, lazy-loading.");
    if(score < 60) items.push("Tracking prüfen: Consent → Events (CTA, Scroll, Accordion), Zielvorlagen im Ads-Backend.");
    if(items.length === 0) items.push("Feinschliff: Microcopy testen, Sekundär-CTA im Footer, PDF-Export optional.");
    return items;
  }

  function onAnalyze(e: React.FormEvent){
    e.preventDefault();
    const el = urlInputRef.current;
    if(!el) return;
    const url = el.value.trim();
    if(!url) return;
    const raw = computeFakeScore(url);
    const s = Math.min(100, Math.round(raw*0.95 + 5));
    setScore(s);
    setSummary(buildSummarySentence(s));
    setImprovements(buildImprovements(s));
  }

  function onSendFeedback(){
    if(!feedback.trim()){
      setFbMsg("Bitte kurz beschreiben, was dich stört.");
      return;
    }
    try{
      localStorage.setItem("lpchecker_feedback", JSON.stringify({text: feedback.trim(), ts: Date.now()}));
    }catch{}
    setFbMsg("Danke! Feedback gespeichert (lokal).");
    setFeedback("");
    setFeedbackOpen(false);
  }

  return (
    <>
      <Head>
        <title>LP Checker — Fallback UI</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <header className="site-header">
        <div className="container header-inner">
          <div className="brand">
            <span className="dot" />
            <span>LP Checker</span>
          </div>
          <nav className="nav" style={{ ["--nav-link-color" as any]: navLinkColor } as any}>
            <a href="#" className="nav-link">Analyzer</a>
            <a href="#" className="nav-link">Example LP</a>
            <a href="#" className="nav-link">Docs</a>
          </nav>
        </div>
      </header>

      <main className="container main">
        <section className="card">
          <div className="card-head">
            <h1>Landingpage Analyzer</h1>
            <div className="score-wrap">
              <span className="label">Score</span>
              <span className={`score-badge ${score !== null ? colorClass(score) : ""}`}>{score ?? "–"}</span>
            </div>
          </div>
          <form className="row gap" onSubmit={onAnalyze}>
            <input ref={urlInputRef} type="url" placeholder="URL einfügen (https://…)" required />
            <button type="submit" className="btn primary">Analyze</button>
          </form>

          <div className="summary">
            <h2>Management Summary</h2>
            <p className="muted">{summary}</p>
          </div>

          <div className="improvements">
            <h2>Improvements</h2>
            <ul className="checklist">
              {improvements.map((s,i)=>(<li key={i}>{s}</li>))}
            </ul>
          </div>
        </section>

        <section className="card">
          <div className="dropdown">
            <button
              type="button"
              className="dropdown-summary"
              aria-expanded={feedbackOpen}
              onClick={()=> setFeedbackOpen(v => !v)}
            >
              <span>Feedback</span>
              <span className={`chevron ${feedbackOpen ? "open": ""}`}>▾</span>
            </button>
            {feedbackOpen && (
              <div className="dropdown-body">
                <label className="label">Dein Feedback</label>
                <textarea rows={4} placeholder="Was sollen wir verbessern?" value={feedback} onChange={(e)=> setFeedback(e.target.value)} />
                <div className="row right gap">
                  <button className="btn" type="button" onClick={()=> { setFeedback(""); setFbMsg("Verworfen."); }}>Abbrechen</button>
                  <button className="btn secondary" type="button" onClick={onSendFeedback}>Senden</button>
                </div>
                <p className="muted small">{fbMsg}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>© Tim Clausen 2025</p>
        </div>
      </footer>

      <style jsx global>{`
:root{
  --bg: #0b0c10;
  --card: #151820;
  --text: #e7eaf0;
  --muted: #a0a6b4;
  --accent: #ff6e00;
  --ok: #2ecc71;
  --warn: #f1c40f;
  --bad: #e74c3c;
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif;
}

.container{width:min(1100px, 92%); margin-inline:auto}

.site-header{
  position:sticky; top:0; z-index:10;
  backdrop-filter:saturate(140%) blur(6px);
  background: rgba(10,12,16,0.6);
  border-bottom:1px solid rgba(255,255,255,0.06);
}
.header-inner{display:flex; align-items:center; justify-content:space-between; padding:12px 0}
.brand{display:flex; align-items:center; gap:10px; font-weight:700; letter-spacing:0.3px}
.brand .dot{width:10px; height:10px; background:var(--accent); border-radius:50%}

.nav{display:flex; gap:18px}
.nav-link{
  color: var(--nav-link-color, #ffffff);
  text-decoration:none; opacity:0.9;
}
.nav-link:hover{opacity:1; text-decoration:underline}

.main{padding:28px 0; display:grid; gap:16px}

.card{
  background: var(--card);
  border:1px solid rgba(255,255,255,0.06);
  border-radius:16px; padding:18px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
}
.card-head{display:flex; align-items:center; justify-content:space-between; gap:16px}
.card h1{margin:0; font-size:22px}
h2{margin:18px 0 10px 0; font-size:16px}

.row{display:flex; align-items:center}
.row.gap{gap:10px}
.row.right{justify-content:flex-end}

input[type="url"]{
  flex:1; padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.12);
  background:#0f1218; color:var(--text);
}
input::placeholder{color:#7c8496}

.btn{
  padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.14);
  color:var(--text); background:transparent; cursor:pointer;
}
.btn.primary{ background: var(--accent); border-color:var(--accent); color:#0b0c10; font-weight:700}
.btn.secondary{ border-color:var(--accent); color:var(--accent); background:transparent }
.btn:disabled{opacity:0.6; cursor:not-allowed}

.score-wrap{display:flex; align-items:center; gap:8px}
.score-wrap .label{color:var(--muted); font-size:12px}
.score-badge{
  display:inline-flex; align-items:center; justify-content:center;
  min-width:42px; padding:4px 10px; border-radius:999px; font-weight:700;
  background:#222837; border:1px solid rgba(255,255,255,0.12);
}

.muted{color:var(--muted)}
.small{font-size:12px}

.checklist{list-style:none; padding-left:0; margin:10px 0}
.checklist li{padding:8px 0; border-bottom:1px dashed rgba(255,255,255,0.08)}
.checklist li:last-child{border-bottom:none}

.site-footer{padding:28px 0; color:var(--muted); text-align:center}

/* Feedback Dropdown */
.dropdown{border-radius:12px; overflow:hidden;}
.dropdown-summary{
  display:flex; align-items:center; justify-content:space-between;
  width:100%;
  cursor:pointer; padding:8px 0; font-weight:600; background:transparent; border:none; color:inherit;
}
.chevron{transition: transform 0.15s ease}
.chevron.open{transform: rotate(180deg)}
.dropdown-body{border-top:1px solid rgba(255,255,255,0.06); padding-top:12px}
textarea{
  width:100%; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.12);
  background:#0f1218; color:var(--text); margin:6px 0 12px 0;
}

/* Score coloring */
.score-good{background:rgba(46, 204, 113, 0.15)!important; border-color:rgba(46, 204, 113, 0.45)!important; color:#2ecc71!important}
.score-mid{background:rgba(241, 196, 15, 0.12)!important; border-color:rgba(241, 196, 15, 0.45)!important; color:#f1c40f!important}
.score-bad{background:rgba(231, 76, 60, 0.12)!important; border-color:rgba(231, 76, 60, 0.45)!important; color:#e74c3c!important}
      `}</style>
    </>
  );
}
