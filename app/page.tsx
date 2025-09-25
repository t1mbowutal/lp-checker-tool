"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!url) return;
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    setResult(data);
  };

  return (
    <main className="min-h-screen bg-[#111] text-gray-100 p-8">
      <h1 className="text-3xl font-bold text-white">
        Bottom of Funnel (BoFu) Landing Page Checker
      </h1>

      {/* Info-Satz, was das Tool macht/nicht macht */}
      <p className="text-sm text-gray-300 mt-2">
        This tool checks SEA/BoFu landing pages for structure, clarity, and
        conversion potential. It does not measure real traffic, tracking, or
        live campaign results.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter landing page URL"
          className="flex-1 rounded p-2 text-black"
        />
        <button
          onClick={handleAnalyze}
          className="bg-[#ff6e00] hover:bg-orange-600 text-white px-4 py-2 rounded"
        >
          Analyze
        </button>
        <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">
          Export as PDF
        </button>
      </div>

      {result && (
        <div className="mt-10">
          {/* Executive Summary Block */}
          <h2 className="text-3xl font-bold text-white mb-2">
            Executive Summary
          </h2>
          <p className="text-xl font-bold text-[#ff6e00] mb-4">
            Overall score: {result.overallScore}/100 — {result.level}
          </p>

          <p className="text-base text-gray-200 leading-relaxed">
            {result.summary}
          </p>

          {/* Beispiel für weitere Boxen etc. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div className="bg-gray-800 p-4 rounded">
              <h3 className="font-semibold">What works</h3>
              <ul className="list-disc list-inside text-sm text-gray-300">
                {result.works?.map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <h3 className="font-semibold">Improvements</h3>
              <ul className="list-disc list-inside text-sm text-gray-300">
                {result.improvements?.map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
