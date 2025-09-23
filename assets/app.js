(() => {
  const API = '/api/analyze';
  const $ = (sel) => document.querySelector(sel);

  const btn = $('#analyzeBtn');
  const input = $('#targetUrl');
  const report = $('#report');
  const fbUp = $('#fbUp');
  const fbDown = $('#fbDown');
  const fbStatus = $('#fbStatus');
  const exportCsvBtn = $('#exportCsv');

  // kleiner Smoke-Test in der Konsole
  console.log('app.js loaded');

  function qual(score){
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Very poor';
  }

  function saveFeedbackLocally(entry){
    const key = 'lpFeedback';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push(entry);
    localStorage.setItem(key, JSON.stringify(list));
  }

  function exportCsv(){
    const key = 'lpFeedback';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if (!list.length){ alert('No feedback to export yet.'); return; }
    const headers = ['timestamp','url','overall','bofu','convincing','technical','vote','positives','improvements'];
    const rows = list.map(r => [
      new Date(r.ts).toISOString(),
      r.url,
      Math.round(r.scores.overall),
      Math.round(r.scores.bofu),
      Math.round(r.scores.convincing),
      Math.round(r.scores.technical),
      r.vote,
      (r.positives||[]).join(' | '),
      (r.improvements||[]).join(' | ')
    ]);
    const csv = [headers.join(','), ...rows.map(a => a.map(x => `"${String(x).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lp-feedback.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

      fbStatus.textContent = '';
      fbUp.onclick = () => { saveFeedbackLocally({ url, ...data, vote:'up', ts: Date.now() }); fbStatus.textContent='Saved locally.'; };
      fbDown.onclick = () => { saveFeedbackLocally({ url, ...data, vote:'down', ts: Date.now() }); fbStatus.textContent='Saved locally.'; };
      exportCsvBtn.onclick = exportCsv;

      report.hidden = false;
    } catch (e){
      alert(e.message || 'Failed to analyze.');
      console.error(e);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Analyze';
    }
  }

  btn?.addEventListener('click', analyze);
  input?.addEventListener('keydown', (e)=>{ if(e.key==='Enter') analyze(); });

  const exportBtn = document.getElementById('exportPdfBtn');
  exportBtn?.addEventListener('click', () => {
    const element = document.querySelector('.report');
    const opt = { margin: 10, filename: 'bofu-landingpage-report.pdf', image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
    window.html2pdf().set(opt).from(element).save();
  });
})();