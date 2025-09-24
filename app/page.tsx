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

  function exportPdf() {
    const content = document.getElementById("result-block")?.innerHTML || "";
    const w = window.open("", "pdf");
    if (!w) return;
    w.document.write(`<html><body>${content}</body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <div className="container">
      <h1>SEA Landingpage Checker</h1>
      <div className="card vstack">
        <label htmlFor="url">Landingpage URL</label>
        <div className="hstack">
          <input
            id="url"
            className="input"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="button" onClick={analyze} disabled={loading || !url}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
          {result && (
            <button className="button" onClick={exportPdf}>
              Export PDF
            </button>
          )}
        </div>
      </div>

      {error && <div className="card error">{error}</div>}

      {result && (
        <div id="result-block" className="card vstack">
          <div className="hstack space-between">
            <div className="hstack">
              <span className="badge">Status: {result.status ?? "n/a"}</span>
              <span className="badge">Time: {result.durationMs} ms</span>
            </div>
            <a href={result.url} target="_blank" rel="noreferrer" className="badge">Open URL</a>
          </div>

          <div className="grid">
            <div className="stat"><small>Title</small><div>{result.title || "—"}</div></div>
            <div className="stat"><small>Description</small><div>{result.description || "—"}</div></div>
            <div className="stat"><small>H1 Count</small><div>{result.h1Count}</div></div>
            <div className="stat"><small>Canonical</small><div>{result.canonical || "—"}</div></div>
          </div>

          <div className="vstack">
            <b>Issues & Hints</b>
            {result.issues.length === 0 ? (
              <div>No obvious issues found.</div>
            ) : (
              <ul>{result.issues.map((it,i)=>(<li key={i}>{it}</li>))}</ul>
            )}
          </div>

          <div className="dropdown">
            <details>
              <summary>Landingpage Checklist</summary>
              <ul>
                <li>Clear H1 headline</li>
                <li>Primary CTA above the fold</li>
                <li>Meta description present</li>
                <li>Canonical tag set</li>
                <li>Tracking codes implemented</li>
              </ul>
            </details>
          </div>
        </div>
      )}

      <footer className="footer">© Tim Clausen 2025</footer>
    </div>
  );
}
