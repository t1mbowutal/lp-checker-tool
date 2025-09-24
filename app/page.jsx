'use client';
import { useState } from 'react';
import ScoreBar from './components/ScoreBar';
import { shortenUrl } from './lib/utils';

export default function Home() {
  const [url, setUrl] = useState('');
  const [displayUrl, setDisplayUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    setDisplayUrl(url);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{padding:24, maxWidth:1000, margin:'0 auto'}}>
      <h1 style={{fontSize:18, marginBottom:6}}>Bottom of Funnel (BoFu) Landing Page Checker</h1>
      <p style={{fontSize:12, color:'#9ca3af', marginBottom:12}}>
        Score BoFu/CTA, conversion clarity, convincing signals, and technical basics.
      </p>

      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <input
          value={url}
          onChange={(e)=>setUrl(e.target.value.trim())}
          placeholder="Paste landing page URL…"
          style={{
            flex:1,
            background:'#0b0d12',
            border:'1px solid #1f2937',
            padding:'10px 12px',
            borderRadius:8,
            color:'#ffffff' // URL in white for readability
          }}
        />
        <button onClick={analyze} disabled={loading || !url} style={{
          background:'#f59e0b',
          color:'#111827',
          border:'none',
          borderRadius:8,
          padding:'10px 14px',
          cursor:'pointer',
          fontWeight:600
        }}>{loading ? 'Analyzing…' : 'Analyze'}</button>
      </div>

      {displayUrl && (
        <div style={{marginTop:8, fontSize:12, color:'#ffffff'}} title={displayUrl}>
          URL: {shortenUrl(displayUrl, 72)}
        </div>
      )}

      <div style={{marginTop:16}} />

      {error && (
        <div style={{background:'#1f2937', color:'#fecaca', border:'1px solid #991b1b', padding:12, borderRadius:8}}>
          {error}
        </div>
      )}

      {result && (
        <section style={{marginTop:16, background:'#0b0d12', border:'1px solid #1f2937', borderRadius:12, padding:16}}>
          <h2 style={{fontSize:14, marginBottom:8, color:'#e5e7eb'}}>Landing page snapshot</h2>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12}}>
            <ScoreBar label="Overall" score={result.scores.overall} />
            <ScoreBar label="Purchase / BoFu" score={result.scores.bofu} />
            <ScoreBar label="Convincing" score={result.scores.convincing} />
            <ScoreBar label="Technical" score={result.scores.technical} />
          </div>

          <div style={{marginTop:16}} />
          <h3 style={{fontSize:13, color:'#9ca3af'}}>What works</h3>
          <ul style={{marginTop:6, marginLeft:18}}>
            {result.highlights.map((h, i)=> <li key={i} style={{fontSize:12}}>{h}</li>)}
          </ul>

          <div style={{marginTop:12}} />
          <h3 style={{fontSize:13, color:'#9ca3af'}}>Improvements</h3>
          <ul style={{marginTop:6, marginLeft:18}}>
            {result.improvements.map((h, i)=> <li key={i} style={{fontSize:12}}>{h}</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}