import type { FeatureSet, ScoreResult, WeightsConfig } from "./types";

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const safeNum = (x: any, d: number) => (Number.isFinite(Number(x)) ? Number(x) : d);
const truthy = (x: any) => !!x;

export function scoreV2(features: FeatureSet, cfg: WeightsConfig): ScoreResult {
  const per: Record<string, number> = {};

  // HERO
  {
    const p = cfg.pillars?.hero_bundle || {};
    const comp = p.components || {};
    const partial = p.partial || {};
    let s = 0;
    const hq = safeNum(features.hero?.headline_quality, 0);
    if (hq >= 0.75) s += comp.headline ?? 2;
    else if (hq >= 0.5) s += partial.weak_headline ?? 1;
    const vp = safeNum(features.hero?.value_prop, 0);
    if (vp >= 1) s += comp.value_prop ?? 2;
    else if (vp >= 0.5) s += partial.vague_value_prop ?? 1;
    const cta = safeNum(features.hero?.cta_atf, 0);
    if (cta >= 1) s += comp.cta_atf ?? 2;
    else if (cta >= 0.5) s += partial.low_cta_visibility ?? 1;
    per.hero_bundle = clamp(s, 0, p.max ?? 6);
  }

  // CTA
  {
    const p = cfg.pillars?.cta || {};
    const mult = p.multiplier ?? 1.0;
    let s = 0;
    const primary = truthy(features.cta?.primary_present);
    const contrast = safeNum(features.cta?.contrast, 0);
    const tapOk = truthy(features.cta?.tap_target_ok);
    const secondary = truthy(features.cta?.secondary_present);
    if (!primary) s += -8;
    if (primary && contrast < 0.5) s += -4;
    if (primary && contrast >= 0.5) s += +4;
    if (secondary) s += +2;
    if (!tapOk) s += -2;
    s *= mult;
    per.cta = Math.min(s, p.cap ?? 12);
  }

  // FORM
  {
    const p = cfg.pillars?.form || {};
    const fields = safeNum(features.form?.fields, NaN);
    let penalty = 0;
    if (Number.isFinite(fields)) {
      const tiers = p.tiers_fields || [];
      for (const t of tiers) {
        if (fields <= t.max_fields) { penalty = t.penalty; break; }
      }
    }
    let bonus = 0;
    if (truthy(features.form?.progressive)) bonus += p.bonuses?.progressive_disclosure ?? 0;
    if (truthy(features.form?.inline_validation)) bonus += p.bonuses?.inline_validation ?? 0;
    if (truthy(features.form?.privacy_hint)) bonus += p.bonuses?.clear_privacy_hint ?? 0;
    const cap = p.cap ?? 10;
    per.form = Math.max(-cap, Math.min(cap, penalty + bonus));
  }

  // TRUST
  {
    const p = cfg.pillars?.trust || {};
    const mult = p.multiplier ?? 1.0;
    const count =
      (truthy(features.trust?.iso) ? 1 : 0) +
      (truthy(features.trust?.awards) ? 1 : 0) +
      (truthy(features.trust?.privacy_hint) ? 1 : 0) +
      (truthy(features.trust?.security_hint) ? 1 : 0);
    let s = 0;
    const steps = p.steps || [];
    for (const st of steps) if (count >= st.count) s = st.delta;
    s *= mult;
    per.trust = Math.min(s, p.cap ?? 8);
  }

  // SOCIAL PROOF
  {
    const p = cfg.pillars?.social_proof || {};
    const mult = p.multiplier ?? 1.0;
    const elems =
      safeNum(features.proof?.testimonials, 0) +
      safeNum(features.proof?.cases, 0) +
      safeNum(features.proof?.reviews, 0) +
      safeNum(features.proof?.client_logos, 0);
    let s = 0;
    const dim = p.diminishing || [];
    for (const st of dim) if (elems >= st.count) s = st.delta;
    s *= mult;
    per.social_proof = Math.min(s, p.cap ?? 7);
  }

  // MOBILE
  {
    const p = cfg.pillars?.mobile || {};
    let s = 0;
    const viewport = truthy(features.mobile?.viewport_ok);
    const tapIssues = Math.max(0, safeNum(features.mobile?.tap_issues, 0));
    const stickyOverlap = truthy(features.mobile?.sticky_overlap);
    if (viewport) s += p.binary_partial?.basic_ok ?? 2;
    if (viewport && tapIssues === 0 && !stickyOverlap) s = p.binary_partial?.good ?? 4;
    if (tapIssues > 0) s -= Math.min(2, tapIssues);
    if (stickyOverlap) s -= 2;
    per.mobile = Math.max(-(p.cap ?? 4), Math.min(p.cap ?? 4, s));
  }

  // SPEED
  {
    const p = cfg.pillars?.speed || {};
    let s = 0;
    const perc = safeNum(features.speed?.percentile, NaN);
    if (Number.isFinite(perc)) {
      if (perc <= 25) s = p.percentile_map?.p25_or_better ?? 4;
      else if (perc <= 50) s = p.percentile_map?.p25_to_p50 ?? 2;
      else if (perc <= 75) s = p.percentile_map?.p50_to_p75 ?? 0;
      else s = p.percentile_map?.worse_than_p75 ?? -4;
    } else {
      const blockers = safeNum(features.speed?.blocking_head_tags, 0);
      const heroKb = safeNum(features.speed?.hero_img_kb, 0);
      if (blockers >= 4) s -= 2;
      if (heroKb > 500) s -= 2;
      if (blockers <= 1 && heroKb <= 250) s += 2;
    }
    per.speed = Math.max(-(p.cap ?? 4), Math.min(p.cap ?? 4, s));
  }

  // COPY
  {
    const p = cfg.pillars?.copy || {};
    let s = 0;
    const bullets = truthy(features.copy?.benefit_bullets);
    const nums = truthy(features.copy?.numbers_in_copy);
    if (bullets && nums) s += p.pair_bonus?.both_present ?? 4;
    else if (bullets || nums) s += p.pair_bonus?.either_headline_or_bullets ?? 2;
    const jr = safeNum(features.copy?.jargon_ratio, 0);
    if (jr > 0.5) s -= 2;
    per.copy = Math.max(-(p.cap ?? 4), Math.min(p.cap ?? 4, s));
  }

  // SEO MISC
  {
    const p = cfg.pillars?.seo_misc || {};
    const mult = p.multiplier ?? 1.0;
    let s = 0;
    const basicMeta = (truthy(features.seo_misc?.h1) && truthy(features.seo_misc?.title_ok)) ? 1 : 0;
    if (basicMeta) s += 1;
    if (truthy(features.seo_misc?.schema_faq)) s += 1;
    if (truthy(features.seo_misc?.missing_title_or_h1)) s -= 2;
    s *= mult;
    per.seo_misc = Math.max(-(p.cap ?? 3), Math.min(p.cap ?? 3, s));
  }

  // Sum & calibrate
  let totalRaw = 0;
  for (const k of Object.keys(per)) totalRaw += per[k];
  const cal = cfg.calibration || { a: 1, b: 0, min: 0, max: 100 };
  const withBias = totalRaw + (cfg.calibration?.bias_offset ?? 0);
  const aff = cal.a * withBias + cal.b;
  const total = clamp(Math.round(aff), cal.min ?? 0, cal.max ?? 100);
  return { total, perPillar: per, calibration: { a: cal.a, b: cal.b, min: cal.min, max: cal.max } };
}
