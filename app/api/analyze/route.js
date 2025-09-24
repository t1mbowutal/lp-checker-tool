import * as cheerio from 'cheerio';

export async function POST(req) {
  try {
    const { url } = await req.json();
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response('Ungültige URL', { status: 400 });
    }

    // Fetch HTML (server-side; avoids CORS)
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 SEA-LP-Checker' } });
    if (!res.ok) {
      return new Response('Seite nicht erreichbar (' + res.status + ')', { status: 502 });
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // Title
    const title = ($('title').first().text() || '').trim();
    const titleLen = title.length;
    const titleOk = titleLen >= 10 && titleLen <= 65;

    // Meta description
    const metaDesc = ($('meta[name="description"]').attr('content') || '').trim();
    const mdLen = metaDesc.length;
    const metaOk = mdLen >= 50 && mdLen <= 165;

    // H1
    const h1s = $('h1');
    const h1Count = h1s.length;
    const h1Ok = h1Count >= 1 && h1Count <= 2;

    // Words (rough estimate)
    const bodyText = $('body').text().replace(/\s+/g,' ').trim();
    const words = bodyText ? bodyText.split(' ').filter(Boolean).length : 0;
    const wordsOk = words >= 150;

    // Canonical
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    const canonicalOk = !!canonical;

    // Robots
    const robots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
    const robotsOk = !(robots.includes('noindex') || robots.includes('nofollow'));

    // Images alt ratio
    const imgs = $('img');
    let withAlt = 0;
    imgs.each((_, el) => {
      const alt = ($(el).attr('alt') || '').trim();
      if (alt) withAlt++;
    });
    const imgCount = imgs.length;
    const altRatio = imgCount ? (withAlt / imgCount) * 100 : 100;
    const imagesOk = altRatio >= 70;

    // Links count (unique hrefs on page)
    const hrefs = new Set();
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href');
      if (href) hrefs.add(href);
    });
    const linksCount = hrefs.size;

    // Score (simple weighting)
    let score = 0;
    score += titleOk ? 15 : 0;
    score += metaOk ? 15 : 0;
    score += h1Ok ? 10 : 0;
    score += wordsOk ? 15 : 0;
    score += canonicalOk ? 10 : 0;
    score += robotsOk ? 10 : 0;
    score += imagesOk ? 15 : 0;
    // Links not directly scored, but informative
    score = Math.max(0, Math.min(100, score));

    const genDetail = (okTrue, okMsg, failMsg) => okTrue ? okMsg : failMsg;

    const payload = {
      url,
      score,
      title: { ok: titleOk, value: title, length: titleLen, detail: genDetail(titleOk, `Länge: ${titleLen} Zeichen`, 'Empfohlen: 10–65 Zeichen') },
      meta: { ok: metaOk, value: metaDesc, length: mdLen, detail: genDetail(metaOk, `Länge: ${mdLen} Zeichen`, 'Empfohlen: 50–165 Zeichen') },
      h1: { ok: h1Ok, count: h1Count, detail: h1Ok ? `H1 Count: ${h1Count}` : `H1 fehlt oder zu viele (${h1Count})` },
      words: { ok: wordsOk, count: words, detail: wordsOk ? 'OK (≥150)' : 'Wenig Text – unter 150 Wörtern' },
      canonical: { ok: canonicalOk, value: canonical, detail: canonicalOk ? canonical : 'Fehlt' },
      robots: { ok: robotsOk, value: robots, detail: robotsOk ? 'Indexierung erlaubt' : `Auffällig: robots="${robots}"` },
      images: { ok: imagesOk, ratio: altRatio, count: imgCount, detail: imgCount ? `${withAlt}/${imgCount} Bilder mit alt (${altRatio.toFixed(0)}%)` : 'Keine Bilder gefunden' },
      links: { count: linksCount, detail: 'Anzahl eindeutiger Links' },
      sampleLanding: '/sample'
    };

    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response('Interner Fehler: ' + err.message, { status: 500 });
  }
}
