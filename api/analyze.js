
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bodyRaw = Buffer.concat(chunks).toString('utf8') || '{}';
    let body = {};
    try { body = JSON.parse(bodyRaw); } catch (e) {}
    const target = (body.url || '').trim();
    if (!/^https?:\/\//i.test(target)) {
      res.status(400).json({ error: 'Provide a full URL starting with http(s)://'});
      return;
    }
    const response = await fetch(target, {
      redirect: 'follow',
      headers: {
        'user-agent': 'LP-Checker/1.0',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const status = response.status;
    const finalUrl = response.url;
    const html = await response.text();

    const getMeta = (name) => {
      const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
      const m = html.match(re);
      return m ? m[1] : '';
    };
    const getMetaProperty = (prop) => {
      const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
      const m = html.match(re);
      return m ? m[1] : '';
    };

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    const metaDesc = getMeta('description') || getMetaProperty('og:description') || '';

    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const canonical = canonicalMatch ? canonicalMatch[1] : '';

    const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
      .map(m => (m[1] || '').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()).filter(Boolean);
    const h2s = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
      .map(m => (m[1] || '').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()).filter(Boolean);

    const ctaTexts = ['get started','request demo','book demo','contact','kontakt','angebot','angebot anfordern','buy','kaufen','subscribe','anfragen','jetzt starten','free trial','start now','download','learn more','mehr erfahren','zum angebot','jetzt kaufen','jetzt testen','angebot holen'];
    const linkBtnRegex = /<(a|button)[^>]*>([\s\S]*?)<\/(a|button)>/gi;
    let ctas = [];
    for (const m of html.matchAll(linkBtnRegex)) {
      const raw = (m[2] || '').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().toLowerCase();
      if (!raw) continue;
      if (ctaTexts.some(k => raw.includes(k))) ctas.push(raw);
    }
    ctas = Array.from(new Set(ctas));

    const forms = [...html.matchAll(/<form\b/gi)].length;
    const hasTel = /tel:|\+?\d{2,}[\s-]?\d{2,}/i.test(html);
    const hasEmail = /mailto:|@\w+\./i.test(html);

    const firstChunk = html.slice(0, 4000).toLowerCase();
    const hasHero = /<h1\b/i.test(firstChunk) && (/<button|<a/i.test(firstChunk));

    const imgCount = [...html.matchAll(/<img\b[^>]*>/gi)].length;
    const imgWithAlt = [...html.matchAll(/<img\b[^>]*alt=["'][^"']+["'][^>]*>/gi)].length;

    // Simple scoring out of 100
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
    if (score > 100) score = 100;

    res.status(200).json({
      status,
      finalUrl,
      title,
      metaDesc,
      canonical,
      h1s,
      h2s,
      ctas,
      forms,
      hasTel,
      hasEmail,
      hasHero,
      imgCount,
      imgWithAlt,
      score
    });
  } catch (err) {
    res.status(500).json({ error: 'Analyzer failed', detail: String(err) });
  }
}
