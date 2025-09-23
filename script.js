document.getElementById('analyzeBtn').addEventListener('click', () => {
  const urlInput = document.getElementById('urlInput').value.trim();
  if (!urlInput) {
    alert('Please enter a valid URL.');
    return;
  }
  runAnalysis(urlInput);
});

function runAnalysis(url) {
  const report = document.getElementById('reportContent');
  report.innerHTML = '<p>Analyzing ' + shortenUrl(url) + ' ...</p>';

  // Fake results for demo
  setTimeout(() => {
    report.innerHTML = `
      <div class="report-item" data-tooltip="Page title shown in browser tab">
        <strong>Title:</strong> Example Landingpage
        <div class="score-bar"><div class="score-fill" style="width:80%"></div></div>
      </div>
      <div class="report-item" data-tooltip="Meta description snippet in search results">
        <strong>Meta Description:</strong> Short pitch line for search engines.
        <div class="score-bar"><div class="score-fill" style="width:60%"></div></div>
      </div>
      <div class="report-summary">
        <h3>Summary & Recommendation</h3>
        <p>Overall good structure. Improve meta description length and add more proof elements to increase trust.</p>
      </div>
      <div class="total-score">
        <strong>Total Score: 72/100</strong>
      </div>
    `;
  }, 1200);
}

function shortenUrl(url) {
  if (url.length > 60) {
    return url.slice(0, 57) + '...';
  }
  return url;
}
