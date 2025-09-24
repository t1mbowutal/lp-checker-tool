"use client";

import { useState } from "react";

type Result = {
  ok: boolean;
  url: string;
  status: number | null;
  durationMs: number;
  title?: string | null;
  description?: string | null;
  h1Count?: number;
  canonical?: string | null;
  issues: string[];
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    setResult(null);
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: Result = await res.json();
      setResult(data);
    } catch (e:any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>SEA Landingpage Checker</h1>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
      />
      <button onClick={analyze} disabled={loading || !url}>
        {loading ? "Analyzing..." : "Analyze"}
      </button>
      {error && <div style={{color:"red"}}>{error}</div>}
      {result && (
        <div>
          <p>Status: {result.status}</p>
          <p>Time: {result.durationMs} ms</p>
          <p>Title: {result.title || "—"}</p>
          <p>Description: {result.description || "—"}</p>
          <p>H1 Count: {result.h1Count}</p>
          <p>Canonical: {result.canonical || "—"}</p>
          <ul>{result.issues.map((it,i)=>(<li key={i}>{it}</li>))}</ul>
        </div>
      )}
      <footer style={{marginTop:"1rem",fontSize:"0.8rem",color:"#888"}}>© Tim Clausen 2025</footer>
    </div>
  );
}
