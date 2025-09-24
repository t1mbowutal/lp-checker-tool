'use client';
import { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const defaultChecklist = [
  'Klare, prägnante Headline (Wertversprechen in 1 Satz)',
  'Primärer CTA above the fold (kontrastreich)',
  'Relevante Hero-Grafik oder kurzer Use-Case',
  'Sozialer Beweis (Logos, Testimonials, Zahlen)',
  'Kurz die 3 wichtigsten Vorteile (keine Feature-Liste)',
  'Reibungsarme Formulare (so wenig Felder wie möglich)',
  'Trust-Elemente (Sicherheit, Zertifikate, Garantien)',
  'Technik-Basics (Title, Meta-Description, H1, Canonical)',
  'Ladezeit < 2,5s (Core Web Vitals separat prüfen)',
  'Saubere Navigation / wenig Ablenkung von CTA',
];

// Feature extraction compatible with API payload
function featureVector(data){
  // Use boolean features + alt ratio scaled
  // Order: title_ok, meta_ok, h1_ok, words_ok, canonical_ok, robots_ok, images_ok, alt_ratio_norm
  const f = [
    data.title.ok ? 1 : 0,
    data.meta.ok ? 1 : 0,
    data.h1.ok ? 1 : 0,
    data.words.ok ? 1 : 0,
    data.canonical.ok ? 1 : 0,
    data.robots.ok ? 1 : 0,
    data.images.ok ? 1 : 0,
    Math.max(0, Math.min(1, (data.images.ratio || 0) / 100)),
  ];
  return f;
}

// CSV helpers
function toCSV(rows){
  return rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',')).join('\n');
}
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  const out = [];
  for(const line of lines){
    const row = [];
    let cur = '', inQ = false;
    for(let i=0;i<line.length;i++){
      const c = line[i];
      if(inQ){
        if(c === '"'){
          if(line[i+1] === '"'){ cur += '"'; i++; }
          else { inQ = false; }
        } else cur += c;
      }else{
        if(c === ','){ row.push(cur); cur=''; }
        else if(c === '"'){ inQ = true; }
        else cur += c;
      }
    }
    row.push(cur);
    out.push(row);
  }
  return out;
}

// Simple linear regression via normal equation: w = (X^T X)^{-1} X^T y
function learnWeightsFromCSV(csvText){
  const rows = parseCSV(csvText);
  if(rows.length < 2) throw new Error('CSV benötigt Header + Daten.');
  const header = rows[0].map(h => h.trim().toLowerCase());
  const reqCols = ['title_ok','meta_ok','h1_ok','words_ok','canonical_ok','robots_ok','images_ok','alt_ratio','target_score'];
  for(const col of reqCols){
    if(!header.includes(col)) throw new Error('Fehlende Spalte: ' + col);
  }
  const idx = Object.fromEntries(header.map((h,i)=>[h,i]));
  const X = []; const y = [];
  for(let i=1;i<rows.length;i++){
    const r = rows[i];
    if(!r || r.length===0) continue;
    const f = [
      Number(r[idx['title_ok']]) ? 1 : 0,
      Number(r[idx['meta_ok']]) ? 1 : 0,
      Number(r[idx['h1_ok']]) ? 1 : 0,
      Number(r[idx['words_ok']]) ? 1 : 0,
      Number(r[idx['canonical_ok']]) ? 1 : 0,
      Number(r[idx['robots_ok']]) ? 1 : 0,
      Number(r[idx['images_ok']]) ? 1 : 0,
      Math.max(0, Math.min(1, Number(r[idx['alt_ratio']]) / 100))
    ];
    const t = Number(r[idx['target_score']]);
    if(!isFinite(t)) continue;
    X.push(f); y.push(t);
  }
  if(X.length < 3) throw new Error('Zu wenige Datenreihen zum Lernen (≥3).');

  // Add bias feature
  const Xb = X.map(row => [...row, 1]);
  const XT = transpose(Xb);
  const XTX = matMul(XT, Xb);
  const XTy = matVecMul(XT, y);
  const XTX_inv = invMatrix(XTX); // 9x9
  const w = matVecMul(XTX_inv, XTy); // length 9
  // Separate into weights + bias
  const bias = w[w.length-1];
  const weights = w.slice(0, w.length-1);

  // Normalize to 0..100 heuristic for display: scale weights so that max feature vector (all 1) ~ 100-bias
  const sumW = weights.reduce((a,b)=>a+b,0) || 1;
  const scale = 100 / (sumW + Math.max(0,bias));
  const scaled = weights.map(v => v*scale);
  const biasScaled = Math.max(0, bias*scale);

  return { weights: scaled, bias: biasScaled };
}

function transpose(A){
  const rows = A.length, cols = A[0].length;
  const T = Array.from({length: cols}, ()=>Array(rows).fill(0));
  for(let i=0;i<rows;i++) for(let j=0;j<cols;j++) T[j][i]=A[i][j];
  return T;
}
function matMul(A,B){
  const r=A.length, c=B[0].length, n=B.length;
  const out = Array.from({length:r},()=>Array(c).fill(0));
  for(let i=0;i<r;i++){
    for(let k=0;k<n;k++){
      const aik = A[i][k];
      for(let j=0;j<c;j++){
        out[i][j]+=aik*B[k][j];
      }
    }
  }
  return out;
}
function matVecMul(A,v){
  const r=A.length, c=A[0].length;
  const out = Array(r).fill(0);
  for(let i=0;i<r;i++){
    let s=0;
    for(let j=0;j<c;j++) s += A[i][j]*v[j];
    out[i]=s;
  }
  return out;
}
function invMatrix(M){
  // Gauss-Jordan for small matrices
  const n = M.length;
  const A = M.map(row => row.slice());
  const I = Array.from({length:n}, (_,i)=>{
    const r = Array(n).fill(0); r[i]=1; return r;
  });
  for(let i=0;i<n;i++){
    // pivot
    let p=i;
    for(let r=i+1;r<n;r++) if(Math.abs(A[r][i])>Math.abs(A[p][i])) p=r;
    if(Math.abs(A[p][i])<1e-9) throw new Error('Matrix nicht invertierbar');
    if(p!==i){ [A[i],A[p]]=[A[p],A[i]]; [I[i],I[p]]=[I[p],I[i]]; }
    const piv = A[i][i];
    for(let j=0;j<n;j++){ A[i][j]/=piv; I[i][j]/=piv; }
    for(let r=0;r<n;r++){
      if(r===i) continue;
      const f = A[r][i];
      for(let j=0;j<n;j++){ A[r][j]-=f*A[i][j]; I[r][j]-=f*I[i][j]; }
    }
  }
  return I;
}

export default function Page() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [rows, setRows] = useState([]); // feedback rows
  const [weights, setWeights] = useState([15,15,10,15,10,10,15,10]); // default weights (sum ~100)
  const [bias, setBias] = useState(0);
  const resultRef = useRef(null);

  // Load from localStorage
  useEffect(()=>{
    try{
      const w = JSON.parse(localStorage.getItem('lpw')||'null');
      const b = JSON.parse(localStorage.getItem('lpb')||'null');
      const r = JSON.parse(localStorage.getItem('lprows')||'null');
      if(Array.isArray(w) && w.length===8) setWeights(w);
      if(typeof b==='number') setBias(b);
      if(Array.isArray(r)) setRows(r);
    }catch{}
  },[]);
  useEffect(()=>{ localStorage.setItem('lpw', JSON.stringify(weights)); },[weights]);
  useEffect(()=>{ localStorage.setItem('lpb', JSON.stringify(bias)); },[bias]);
  useEffect(()=>{ localStorage.setItem('lprows', JSON.stringify(rows)); },[rows]);

  async function analyze() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ url })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Analyse fehlgeschlagen');
      }
      const data = await res.json();
      // compute custom score client-side
      const fs = featureVector(data);
      const custom = Math.max(0, Math.min(100, dot(weights, fs) + bias));
      setResult({ ...data, customScore: custom });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function dot(a,b){ return a.reduce((s,v,i)=>s+v*(b[i]||0),0); }

  async function exportPDF() {
    if (!resultRef.current) return;
    const canvas = await html2canvas(resultRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p','mm','a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save('lp-checker-report.pdf');
  }

  function addRow(){
    if(!result) return;
    const r = [
      result.url,
      Number(result.title.ok), Number(result.meta.ok), Number(result.h1.ok),
      Number(result.words.ok), Number(result.canonical.ok), Number(result.robots.ok),
      Number(result.images.ok),
      Number((result.images.ratio||0).toFixed(0)),
      Number((result.customScore||0).toFixed(0)) // current custom score as target (editable later)
    ];
    setRows(prev => [...prev, r]);
  }

  function downloadCSV(){
    const header = ['url','title_ok','meta_ok','h1_ok','words_ok','canonical_ok','robots_ok','images_ok','alt_ratio','target_score'];
    const csv = toCSV([header, ...rows]);
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lp-feedback.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCSVFile(file){
    const text = await file.text();
    try{
      const learned = learnWeightsFromCSV(text);
      setWeights(learned.weights.map(v => Number(v.toFixed(2))));
      setBias(Number(learned.bias.toFixed(2)));
    }catch(e){
      setError('CSV-Fehler: ' + e.message);
    }
  }

  function handleWeightChange(i, val){
    const v = Number(val);
    if(!isFinite(v)) return;
    setWeights(prev => prev.map((w,idx)=> idx===i ? v : w));
  }

  const featureLabels = ['Title','Meta','H1','Words','Canonical','Robots','Images','AltRatio'];

  return (
    <main>
      <header style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'28px', margin:'0 0 8px'}}>SEA Landingpage Checker</h1>
        <p style={{opacity:0.8, margin:0}}>URL einfügen → Analyse → Score. Feedback & CSV: Gewichte lernen ohne Server – alles lokal.</p>
      </header>

      <section style={{display:'grid', gap:'8px', gridTemplateColumns:'1fr auto'}}>
        <input
          value={url}
          onChange={(e)=>setUrl(e.target.value)}
          placeholder="https://example.com/landingpage"
          style={{padding:'12px 14px', borderRadius:12, border:'1px solid #2a3240', background:'#0f141b', color:'#e6e9ef'}}
        />
        <button onClick={analyze} disabled={loading || !url} style={{padding:'12px 16px', borderRadius:12, border:'1px solid #2a3240', background: loading? '#293241' : '#ff6e00', color:'#fff', fontWeight:600, cursor: loading? 'not-allowed':'pointer'}}>Analysieren</button>
      </section>

      <div style={{display:'flex', gap:12, marginTop:12, flexWrap:'wrap'}}>
        <button onClick={()=>setShowChecklist(s=>!s)} style={{padding:'10px 12px', borderRadius:10, border:'1px solid #2a3240', background:'#141a22', color:'#e6e9ef', cursor:'pointer'}}>Landingpage-Checklist</button>
        <button onClick={exportPDF} disabled={!result} style={{padding:'10px 12px', borderRadius:10, border:'1px solid #2a3240', background: result ? '#141a22' : '#222833', color:'#e6e9ef', cursor: result ? 'pointer' : 'not-allowed'}}>Als PDF exportieren</button>
        <button onClick={addRow} disabled={!result} style={{padding:'10px 12px', borderRadius:10, border:'1px solid #2a3240', background: result ? '#141a22' : '#222833', color:'#e6e9ef'}}>Feedback-Zeile hinzufügen</button>
        <button onClick={downloadCSV} disabled={!rows.length} style={{padding:'10px 12px', borderRadius:10, border:'1px solid #2a3240', background: rows.length ? '#141a22' : '#222833', color:'#e6e9ef'}}>CSV herunterladen</button>
        <label style={{border:'1px solid #2a3240', padding:'10px 12px', borderRadius:10, background:'#141a22', cursor:'pointer'}}>
          CSV zum Lernen importieren
          <input type="file" accept=".csv,text/csv" onChange={(e)=>e.target.files?.[0] && importCSVFile(e.target.files[0])} style={{display:'none'}}/>
        </label>
      </div>

      {showChecklist && (
        <ul style={{marginTop:10, padding:16, border:'1px solid #283244', borderRadius:12, background:'#0f141b'}}>
          {defaultChecklist.map((item, i)=> (
            <li key={i} style={{margin:'6px 0'}}>{item}</li>
          ))}
        </ul>
      )}

      {error && <div style={{marginTop:16, padding:12, border:'1px solid #5b1d1d', background:'#281617', borderRadius:10, color:'#ffb4b4'}}>{error}</div>}

      {loading && <div style={{marginTop:16}}>Analysiere…</div>}

      {result && (
        <section ref={resultRef} style={{marginTop:16, padding:16, border:'1px solid #283244', borderRadius:12, background:'#0f141b'}}>
          <h2 style={{marginTop:0}}>Ergebnis</h2>
          <p style={{opacity:0.8, wordBreak:'break-all'}}>URL: {result.url}</p>

          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12}}>
            <Card title="Server-Score" value={result.score.toFixed(0) + ' / 100'} note="API-Heuristik" />
            <Card title="Custom-Score" value={(result.customScore ?? 0).toFixed(0) + ' / 100'} note="Client (lernbar)" />
            <Card title="Title" value={result.title.ok ? 'OK' : 'Fehlt / zu lang'} note={result.title.detail} />
            <Card title="Meta Description" value={result.meta.ok ? 'OK' : 'Fehlt / zu kurz/lang'} note={result.meta.detail} />
            <Card title="H1" value={result.h1.ok ? `${result.h1.count}x` : 'Fehlt'} note={result.h1.detail} />
            <Card title="Wortanzahl" value={String(result.words.count)} note={result.words.detail} />
            <Card title="Canonical" value={result.canonical.ok ? 'OK' : 'Fehlt'} note={result.canonical.detail} />
            <Card title="Robots" value={result.robots.ok ? 'OK' : 'Warnung'} note={result.robots.detail} />
            <Card title="Bilder Alt-Text" value={result.images.ok ? result.images.ratio.toFixed(0)+'% mit alt' : 'Viele ohne alt'} note={result.images.detail} />
            <Card title="Links" value={String(result.links.count)} note={result.links.detail} />
          </div>

          {result.sampleLanding && (
            <div style={{marginTop:16}}>
              <a href={result.sampleLanding} target="_blank" rel="noopener noreferrer" style={{color:'#8ab4ff'}}>Beispiel-Landingpage öffnen</a>
            </div>
          )}
        </section>
      )}

      {/* Weights editor */}
      <section style={{marginTop:16, padding:16, border:'1px solid #283244', borderRadius:12, background:'#0f141b'}}>
        <h3 style={{marginTop:0}}>Gewichtungen (Custom-Score)</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12}}>
          {weights.map((w,i)=>(
            <div key={i} style={{border:'1px solid #2a3240', borderRadius:10, padding:10, background:'#10161f'}}>
              <div style={{fontSize:12, opacity:0.8}}>{featureLabels[i]}</div>
              <input
                type="number"
                step="1"
                value={w}
                onChange={(e)=>handleWeightChange(i, e.target.value)}
                style={{width:'100%', marginTop:6, padding:'8px 10px', borderRadius:8, border:'1px solid #263042', background:'#0f141b', color:'#e6e9ef'}}
              />
            </div>
          ))}
        </div>
        <div style={{marginTop:12}}>
          <span style={{fontSize:12, opacity:0.8}}>Bias: </span>
          <input
            type="number"
            step="1"
            value={bias}
            onChange={(e)=> setBias(Number(e.target.value))}
            style={{width:120, marginLeft:6, padding:'8px 10px', borderRadius:8, border:'1px solid #263042', background:'#0f141b', color:'#e6e9ef'}}
          />
          <span style={{marginLeft:12, fontSize:12, opacity:0.8}}>Summe Gewichte: {weights.reduce((a,b)=>a+b,0).toFixed(0)}</span>
        </div>
        <p style={{opacity:0.7, fontSize:12, marginTop:8}}>
          Tipp: Du kannst deine CSV mit Spalten <code>title_ok, meta_ok, h1_ok, words_ok, canonical_ok, robots_ok, images_ok, alt_ratio, target_score</code> importieren. Daraus werden die Gewichte gelernt.
        </p>
      </section>
    </main>
  );
}

function Card({ title, value, note }){
  return (
    <div style={{border:'1px solid #2a3240', borderRadius:12, padding:12, background:'#10161f'}}>
      <div style={{fontSize:12, opacity:0.8}}>{title}</div>
      <div style={{fontSize:20, fontWeight:700, margin:'6px 0 4px'}}>{value}</div>
      <div style={{fontSize:12, opacity:0.7}}>{note}</div>
    </div>
  );
}
