
'use client';
import { useState } from 'react';
import ReportActions from './components/ReportActions';

type Check = { key:string; label:string; score:number; weight:number; details:string; ok:boolean }
type Result = { url:string; score:number; checks:Check[]; summary:string }

const CRITERIA = [
  'Value Proposition clarity',
  'Hero + primary CTA above the fold',
  'Benefits > Features',
  'Social proof (logos, testimonials)',
  'Simple form (few fields)',
  'Relevant visuals with alt text',
  'Technical SEO basics present (title, meta, H1)',
  'Canonical / OG tags',
  'Mobile responsive viewport',
];

export default function Home(){
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try{
      const res = await fetch('/api/analyze', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ url }) });
      const data = await res.json();
      if(!res.ok) throw new Error(data?.error || 'Analysis failed');
      setResult(data);
    }catch(e:any){
      setError(e.message || 'Analysis failed');
    }finally{
      setLoading(false);
    }
  };

  const ringClass = (score:number) => score >= 80 ? 'scoreRing good' : score >= 60 ? 'scoreRing medium' : 'scoreRing bad';

  return (
    <div className="container">
      <div className="header">
        <div className="brand">SEA Landingpage Checker</div>
        <div className="badge">Clean, no placeholders. Real checks.</div>
      </div>

      <div className="card">
        <div className="row">
          <input className="input" placeholder="https://…" value={url} onChange={e=>setUrl(e.target.value)} />
          <button onClick={run} disabled={!url || loading}>{loading ? 'Analyzing…' : 'Analyze'}</button>
        </div>
        <div style={{marginTop:8}} className="small">
          Kriterien-Quickview:&nbsp;
          <select className="select">
            {CRITERIA.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="card" style={{borderColor:'#ef4444'}}>❌ {error}</div>}

      {result && (
        <div id="report" className="card">
          <div className="row" style={{alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:14}} className="small">Management Summary</div>
              <h2 style={{margin:'4px 0 8px 0'}}>{result.summary}</h2>
              <div className="small">URL: <a href={result.url} target="_blank" rel="noreferrer">{result.url}</a></div>
            </div>
            <div className={ringClass(result.score)}>{result.score}</div>
          </div>

          <hr className="hr" />

          <div className="grid">
            <div className="card">
              <h3>Checks & Weights</h3>
              <table className="table">
                <thead><tr><th>Check</th><th>Details</th><th>Score</th><th>Weight</th></tr></thead>
                <tbody>
                  {result.checks.map(c => (
                    <tr key={c.key}>
                      <td>{c.label}</td>
                      <td className="small">{c.details}</td>
                      <td>{c.score}</td>
                      <td className="small">{c.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>Notes (will be included in CSV)</h3>
              <textarea className="input" style={{minHeight:140}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Kurzfeedback…"></textarea>
              <ReportActions data={result} msText={result.summary + (notes ? (' | Notes: ' + notes) : '')} />
              <div className="small" style={{marginTop:8}}>CSV enthält alle Checks + Management Summary. PDF exportiert die obige Ansicht.</div>
            </div>
          </div>
        </div>
      )}

      <div className="footer">(c) Tim Clausen 2025</div>
    </div>
  );
}
