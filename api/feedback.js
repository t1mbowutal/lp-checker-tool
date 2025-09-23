export const config = { runtime: 'edge' };

async function insertToSupabase(payload){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: true, noop: true };

  // Normalize URL for storage
  try { const u = new URL(payload.url); payload.url = `${u.origin}${u.pathname}`; } catch {}

  const res = await fetch(`${url}/rest/v1/lp_feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text: await res.text() };
  }
  return { ok: true, data: await res.json() };
}

export default async function handler(req){
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405 });
  }
  try{
    const payload = await req.json();
    const result = await insertToSupabase(payload);
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      status: result.ok ? 200 : 500
    });
  }catch(e){
    return new Response(JSON.stringify({ ok:false, error: e.message || 'Failed' }), { status: 500, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
}
