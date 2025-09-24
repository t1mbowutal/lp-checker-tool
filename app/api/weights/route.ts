export const runtime = "edge";

export async function GET(){
  const defaults = {
    weights: { overall: { bofu: 0.50, convincing: 0.35, technical: 0.15 } },
    caps:    { overall: { missing1: 75, missing2: 60, missing3plus: 40 } },
    bofuCaps:{ noCta: 40, noLead: 50, noPricing: 65 }
  };
  return new Response(JSON.stringify(defaults), { headers:{'content-type':'application/json','access-control-allow-origin':'*'} });
}
