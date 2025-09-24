export const runtime = "edge";

export async function GET(){
  const defaults = {
    weights: { overall: { bofu: 0.50, convincing: 0.35, technical: 0.15 } },
    caps:    { overall: { missing1: 78, missing2: 65, missing3plus: 45 } },
    bofuCaps:{ noCta: 45, noLead: 55, noPricing: 70 }
  };
  return new Response(JSON.stringify(defaults), { headers:{'content-type':'application/json','access-control-allow-origin':'*'} });
}
