import "./globals.css";
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
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const data: Result = await res.json();
      setResult(data);
    } catch (e:any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="vstack" style={{gap: 20}}>
        <header className="vstack">
          <h1>SEA Landingpage Checker</h1>
          <small>Paste a public URL. We’ll fetch it server-side and run a few BOFU checks.</small>
        </header>

        <div className="card vstack">
          <label htmlFor="url">Landingpage URL</label>
          <div className="hstack">
            <input
              id="url"
              className="input"
              placeholder="https://example.com/landing"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className="button" onClick={analyze} disabled={loading || !url}>
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>
          <small>We do a simple GET on the server (no CORS issues) and parse HTML.</small>
        </div>

        {error && (
          <div className="card" style={{ borderColor: "var(--danger)" }}>
            <b>Error:</b> {error}
          </div>
        )}

        {result && (
          <div className="card vstack">
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <div className="hstack" style={{ gap: 8 }}>
                <span className="badge">Status: {result.status ?? "n/a"}</span>
                <span className="badge">Time: {result.durationMs} ms</span>
              </div>
              <a href={result.url} target="_blank" rel="noreferrer" className="badge">Open URL</a>
            </div>
            <hr/>
            <div className="grid">
              <div className="stat">
                <div><small>Title</small></div>
                <div>{result.title || "—"}</div>
              </div>
              <div className="stat">
                <div><small>Meta Description</small></div>
                <div>{result.description || "—"}</div>
              </div>
              <div className="stat">
                <div><small>H1 Count</small></div>
                <div>{result.h1Count}</div>
              </div>
              <div className="stat">
                <div><small>Canonical</small></div>
                <div>{result.canonical || "—"}</div>
              </div>
            </div>
            <hr/>
            <div className="vstack">
              <b>Issues & Hints</b>
              {result.issues.length === 0 ? (
                <div>No obvious issues found.</div>
              ) : (
                <ul>
                  {result.issues.map((it, i) => (<li key={i}>{it}</li>))}
                </ul>
              )}
            </div>
          </div>
        )}

        <footer className="footer">
          © Tim Clausen 2025
        </footer>
      </div>
    </div>
  );
}
