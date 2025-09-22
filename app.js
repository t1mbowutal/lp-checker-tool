const $ = sel => document.querySelector(sel);
const statusEl = $("#status");
const resultsEl = $("#results");
const scoreEl = $("#score");

const kv = (label, value) =>
  `<div class="card"><div class="kv"><b>${label}</b><span>${value}</span></div></div>`;

async function analyze(url) {
  statusEl.textContent = "Running…";
  resultsEl.innerHTML = "";
  scoreEl.textContent = "–";
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({ url })
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch {
      throw new Error(`API returned non-JSON (${res.status}): ${text.slice(0,120)}…`);
    }

    if (data.error && !data.status) {
      statusEl.textContent = `Analyzer error: ${data.error} ${data.detail ? '— '+data.detail : ''}`;
      return;
    }

    if (data.status >= 400) {
      statusEl.textContent = `HTTP ${data.status} • Final URL: ${data.finalUrl} ` +
        (data.botHint ? '• Possible bot protection' : '');
    } else {
      statusEl.textContent = `HTTP ${data.status} • Final URL: ${data.finalUrl}`;
    }

    const bullets = [
      kv("Title", data.title || "—"),
      kv("Meta Description", data.metaDesc || "—"),
      kv("Canonical", data.canonical || "—"),
      kv("H1 count", data.h1s?.length ?? 0),
      kv("H2 count", data.h2s?.length ?? 0),
      kv("CTAs detected", (data.ctas || []).join(", ") || "—"),
      kv("Forms", data.forms ?? 0),
      kv("Contact present", (data.hasTel || data.hasEmail) ? "Yes" : "No"),
      kv("Hero (H1 + CTA above the fold)", data.hasHero ? "Likely" : "Unclear"),
      kv("Images with alt", `${data.imgWithAlt}/${data.imgCount}`),
      kv("Content-Type", data.contentType || "—")
    ];
    resultsEl.innerHTML = bullets.join("");
    scoreEl.textContent = `Score: ${data.score ?? '—'}/100`;
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }
}

document.getElementById("analyzeBtn").addEventListener("click", () => {
  const url = document.getElementById("urlInput").value.trim();
  if (!url) { statusEl.textContent = "Please paste a URL."; return; }
  analyze(url);
});

document.getElementById("exportBtn").addEventListener("click", () => {
  window.print();
});
