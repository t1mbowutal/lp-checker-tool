export const runtime = "edge";

async function insertToSupabase(payload:any){
  const url = process.env.SUPABASE_URL as string | undefined;
  const key = process.env.SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return { ok:true, noop:true };
  try { const u = new URL(payload.url); payload.url = `${u.origin}${u.pathname}`; } catch {}
  const res = await fetch(`${url}/rest/v1/lp_feedback`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`,'Prefer':'return=representation' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) return { ok:false, status:res.status, text: await res.text() };
  return { ok:true, data: await res.json() };
}

function toCsvRow(p:any){
  const row = {
    ts: new Date(p.ts || Date.now()).toISOString(),
    url: p.url || "",
    vote: p.vote || "",
    overall: p.scores?.overall ?? "",
    bofu: p.scores?.bofu ?? "",
    convincing: p.scores?.convincing ?? "",
    technical: p.scores?.technical ?? "",
    positives: (p.positives||[]).join(" | "),
    improvements: (p.improvements||[]).join(" | ")
  };
  const esc = (v:any)=>`"${String(v).replaceAll('"','""')}"`;
  const header = "ts,url,vote,overall,bofu,convincing,technical,positives,improvements\n";
  const line = [row.ts,row.url,row.vote,row.overall,row.bofu,row.convincing,row.technical,row.positives,row.improvements].map(esc).join(",") + "\n";
  return { header, line };
}

export async function POST(req: Request){
  try{
    const payload = await req.json();
    const res = await insertToSupabase(payload);
    const { header, line } = toCsvRow(payload);
    const csv = header + line;
    return new Response(JSON.stringify({ ok:true, db:res, csv }), { headers:{'content-type':'application/json','access-control-allow-origin':'*'} });
  }catch(e:any){
    return new Response(JSON.stringify({ ok:false, error:e.message||'Failed' }), { status:500, headers:{'content-type':'application/json','access-control-allow-origin':'*'} });
  }
}
