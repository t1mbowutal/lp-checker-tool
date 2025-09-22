module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
    let body = {}; try { body = JSON.parse(raw); } catch {}

    const target = (body.url || '').trim();
    if (!/^https?:\/\//i.test(target)) {
      res.status(400).json({ error: 'Provide a full URL starting with http(s)://' });
      return;
    }

    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const response = await fetch(target, {
      redirect: 'follow',
      headers: {
        'user-agent': ua,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en,en-GB;q=0.9,de;q=0.8'
      }
    });

    const status = response.status;
    const finalUrl = response.url || target;
    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();
    const safeHtml = typeof html === 'string' ? html : '';

    const pick = (src, re) => { const m = src.match(re); return m ? m[1] : ''; };
    const clean = s => s.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();

    const title = clean(pick(safeHtml, /<title[^>]*>([\s\S]*?)<\/title>/i) || '');
    const metaDesc = pick(safeHtml, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      pick(safeHtml, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const canonical = pick(safeHtml, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);

    const h1s = [...safeHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => clean(m[1])).filter(Boolean);
    const h2s = [...safeHtml.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => clean(m[1])).filter(Boolean);

    const ctaTexts = ['get started','request demo','book demo','contact','kontakt','angebot','angebot anfordern','buy','kaufen','subscribe','anfragen','jetzt starten','free trial','start now','download','learn more','mehr erfahren','zum angebot','jetzt kaufen','jetzt testen','angebot holen'];
    const ctas = Array.from(new Set(
      [...safeHtml.matchAll(/<(a|button)[^>]*>([\s\S]*?)<\/(a|button)>/gi)]
        .map(m => clean(m[2]).toLowerCase())
        .filter(txt => txt && ctaTexts.some(k => txt.includes(k)))
    ));

    const forms = [...safeHtml.matchAll(/<form\b/gi)].length;
    const hasTel = /tel:|\+?\d{2,}[\s-]?\d{2,}/i.test(safeHtml);
    const hasEmail = /mailto:|@\w+\./i.test(safeHtml);
    const firstChunk = safeHtml.slice(0, 4000).toLowerCase();
    const hasHero = /<h1\b/i.test(firstChunk) && (/<button|<a/i.test(firstChunk));
    const imgCount = [...safeHtml.matchAll(/<img\b[^>]*>/gi)].length;
    const imgWithAlt = [...safeHtml.matchAll(/<img\b[^>]*alt=["'][^"']+["'][^>]*>/gi)].length;

    let score = 0;
    if (title) score += 10;
    if (metaDesc) score += 10;
    if (canonical) score += 5;
    if (h1s.length === 1) score += 10; else if (h1s.length > 1) score += 3;
    if (ctas.length > 0) score += 20;
    if (forms > 0) score += 15;
    if (hasHero) score += 10;
    if (imgCount > 0) score += Math.min(10, Math.round((imgWithAlt / Math.max(1, imgCount)) * 10));
    if (hasTel || hasEmail) score += 10;
    if (status >= 400) score = Math.max(10, Math.floor(score * 0.5));
    if (score > 100) score = 100;

    const botHint = /cloudflare|just a moment|access denied|blocked|forbidden/i.test(safeHtml) && status >= 400;

    res.status(200).json({
      status, finalUrl, contentType, botHint,
      title, metaDesc, canonical, h1s, h2s, ctas, forms,
      hasTel, hasEmail, hasHero, imgCount, imgWithAlt, score,
      note: botHint ? 'The target likely blocks automated requests. Try another URL or whitelist.' : ''
    });
  } catch (err) {
    res.status(200).json({ error: 'Analyzer failed', detail: String(err) });
  }
};
