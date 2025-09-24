export const runtime = "edge";

const DEFAULTS = {
  weights: { overall: { bofu: 0.50, convincing: 0.35, technical: 0.15 } },
  caps:    { overall: { missing1: 79, missing2: 69, missing3plus: 49 } },
  bofuCaps:{ noCta: 55, noLead: 60, noPricing: 75 }
};

async function fetchFromSupabase(){
  const url = process.env.SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/lp_config?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  if (!res.ok) return null;
  const list = await res.json();
  return list && list[0] ? list[0] : null;
}

async function upsertToSupabase(body:any){
  const url = process.env.SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return { ok: false, error: 'No DB env configured' };
  const res = await fetch(`${url}/rest/v1/lp_config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) return { ok:false, status: res.status, text: await res.text() };
  return { ok:true, data: await res.json() };
}

export async function GET(){
  const row = await fetchFromSupabase();
  const cfg = (row && (row as any).config) ? (row as any).config : DEFAULTS;
  return new Response(JSON.stringify(cfg), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

export async function POST(req:Request){
  const auth = req.headers.get('authorization') || '';
  const token = process.env.ADMIN_TOKEN || '';
  if (!token || auth !== `Bearer ${token}`){
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const body = await req.json();
  const res = await upsertToSupabase({ id: 1, config: body });
  return new Response(JSON.stringify(res), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, status: (res as any).ok ? 200 : 500 });
}
