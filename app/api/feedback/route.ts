export const runtime = "edge";

async function insertToSupabase(payload:any){
  const url = process.env.SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return { ok: true, noop: true };
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

export async function POST(req: Request){
  try{
    const payload = await req.json();
    const result = await insertToSupabase(payload);
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      status: (result as any).ok ? 200 : 500
    });
  }catch(e:any){
    return new Response(JSON.stringify({ ok:false, error: e.message || 'Failed' }), { status: 500, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
  }
}

export async function GET(){
  return new Response(JSON.stringify({ ok:false, error: "Use POST" }), { status: 405 });
}
