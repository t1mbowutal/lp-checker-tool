(() => {
  const API = '/api/analyze';
  const API_FEEDBACK = '/api/feedback';
  const $ = (sel) => document.querySelector(sel);

  const btn = $('#analyzeBtn');
  const input = $('#targetUrl');
  const report = $('#report');
  const fbUp = $('#fbUp');
  const fbDown = $('#fbDown');
  const fbStatus = $('#fbStatus');

  function qual(score){
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Very poor';
  }

  async function analyze() {
    const url = input.value.trim();
    if (!url) return;
    btn.disabled = true;
    btn.textContent = 'Analyzing...';

    try {
      const res = await fetch(API + '?url=' + encodeURIComponent(url));
      if (!res.ok) throw new Error('API error: ' + res.status);
      const data = await res.json();

      const narrative = (data.summary && data.summary.length) ? `<div class="exec-text" style="margin-top:4px">${data.summary}</div>` : '';
      $('#summary').innerHTML = `<div class="exec">
        <div class="exec-title">Executive summary</div>
        <div class="exec-text">Overall score: <b>${Math.round(data.scores.overall)}</b>/100 — ${qual(Math.round(data.scores.overall))}<br/>URL: <a href="${url}" target="_blank" rel="noopener">${url}</a></div>
        ${narrative}
      </div>`;

      const s = data.scores;
      const set = (id, v) => {
        const el = $(id);
        el.style.width = Math.max(0, Math.min(100, Math.round(v))) + '%';
        el.parentElement.nextElementSibling.textContent = qual(v);
      };
      set('#score-overall', s.overall);
      set('#score-bofu', s.bofu);
      set('#score-convincing', s.convincing);
      set('#score-technical', s.technical);

      const pos = $('#positives'); pos.innerHTML='';
      const imp = $('#improvements'); imp.innerHTML='';
      (data.positives||[]).forEach(t=>{
        const li = document.createElement('li'); li.textContent = t; pos.appendChild(li);
      });
      (data.improvements||[]).forEach(t=>{
        const li = document.createElement('li'); li.textContent = t; imp.appendChild(li);
      });

      // Feedback handlers
      fbStatus.textContent = '';
      fbUp.onclick = () => sendFeedback(url, data, 'up');
      fbDown.onclick = () => sendFeedback(url, data, 'down');

      report.hidden = false;
    } catch (e){
      alert(e.message || 'Failed to analyze.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Analyze';
    }
  }

  async function sendFeedback(url, data, vote){
    fbUp.disabled = true; fbDown.disabled = true;
    fbStatus.textContent = 'Sende Feedback...';
    try{
      const res = await fetch(API_FEEDBACK, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({
          url,
          scores: data.scores,
          positives: data.positives,
          improvements: data.improvements,
          vote,
          ts: Date.now()
        })
      });
      if(!res.ok) throw new Error('Feedback failed');
      fbStatus.textContent = 'Danke!';
    }catch(e){
      fbStatus.textContent = 'Feedback konnte nicht gespeichert werden (no-op).';
    }finally{
      setTimeout(()=>{ fbUp.disabled = false; fbDown.disabled = false; }, 800);
    }
  }

  $('#analyzeBtn').addEventListener('click', analyze);
  $('#targetUrl').addEventListener('keydown', (e)=>{ if(e.key==='Enter') analyze(); });

  const exportBtn = document.getElementById('exportPdfBtn');
  exportBtn.addEventListener('click', () => {
    const element = document.querySelector('.report');
    const opt = { margin: 10, filename: 'bofu-landingpage-report.pdf', image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    window.html2pdf().set(opt).from(element).save();
  });
})();