// src/lib/scoring.ts - ifm-v3 robust scoring (isolated)
export const SCORING_VERSION = "ifm-v3";

export type Signals = {
  h1?: string;
  valuePropPresent?: boolean;
  ctaAboveFold?: boolean;
  formFieldsCount?: number;
  hasTestimonialsOrLogos?: boolean;
  hasImpressumPrivacy?: boolean;
  lcpMs?: number | null;
  cls?: number | null;
  ttiMs?: number | null;
  hasUTM?: boolean;
  adMessage?: string | null;
  pageTitle?: string | null;
  h1Text?: string | null;
  ga4Present?: boolean;
  gtmPresent?: boolean;
  consentVisible?: boolean;
  formBroken?: boolean;
  httpStatusOk?: boolean;
  funnelGoal?: string | null;
};

export type ScoreResult = {
  score: number;
  version: string;
  confidence: number;
  reasons: string[];
  categoryScores: Record<string, number>;
};

const calibration = {
  formPenalty: { startFields: 6, maxPenalty: 6.0 },
  blockers: { httpNotOkCap: 60, formBrokenCap: 60, fieldsOnlyNoHardCap: true },
  funnelBias: {
    "Kontaktformular": 3,
    "Demo buchen": 4,
    "Call buchen": 12,
    "Free Trial": 15,
    "_default": 0
  }
};

export function scoreLanding(signals: Signals): ScoreResult {
  const reasons: string[] = [];
  let confidence = 1;

  const known = <T>(v: T | null | undefined, fallback: T) => {
    if (v === null || v === undefined) { confidence -= 0.03; return fallback; }
    return v;
  };

  // Blockers
  if (signals.httpStatusOk === false) reasons.push("HTTP_NOT_OK");
  if (signals.formBroken) reasons.push("FORM_BROKEN");

  // Clarity & Offer (0–20)
  let clarity = 0;
  if (signals.h1 && signals.h1.trim().length >= 3) clarity += 10;
  if (signals.valuePropPresent) clarity += 10;

  // CTA & Friction (0–20)
  let cta = 0;
  if (signals.ctaAboveFold) cta += 12; else reasons.push("CTA_ABOVE_FOLD_MISSING");
  const fields = known(signals.formFieldsCount, calibration.formPenalty.startFields);
  let penalty = 0;
  if (fields > calibration.formPenalty.startFields) {
    penalty = Math.min(calibration.formPenalty.maxPenalty, (fields - calibration.formPenalty.startFields) * 1.0);
  }
  cta += Math.max(0, 8 - penalty);
  if (fields > 10) reasons.push("FORM_FIELDS_TOO_MANY");

  // Trust & Proof (0–15)
  let trust = 0;
  if (signals.hasTestimonialsOrLogos) trust += 7.5; else reasons.push("NO_SOCIAL_PROOF");
  if (signals.hasImpressumPrivacy) trust += 7.5; else reasons.push("LEGAL_MISSING");

  // UX & Performance (0–20)
  let ux = 0;
  const lcp = known(signals.lcpMs, 3500);
  const cls = known(signals.cls, 0.12);
  const tti = known(signals.ttiMs, 3500);
  const lcpScore = Math.max(0, Math.min(10, 10 * (1 - (lcp - 2500) / (6000 - 2500))));
  const clsScore = Math.max(0, Math.min(5, 5 * (1 - (cls - 0.1) / (0.25 - 0.1))));
  const ttiScore = Math.max(0, Math.min(5, 5 * (1 - (tti - 2500) / (6000 - 2500))));
  ux += lcpScore + clsScore + ttiScore;
  if (lcp > 6000) reasons.push("LCP_SLOW");

  // SEA Match (0–15)
  let sea = 0;
  const msg = (signals.adMessage || "").toLowerCase();
  const h1 = (signals.h1Text || signals.h1 || "").toLowerCase();
  const title = (signals.pageTitle || "").toLowerCase();
  if (msg && (h1.includes(msg) || title.includes(msg))) sea += 10; else if (msg) reasons.push("MESSAGE_MISMATCH");
  if (signals.hasUTM) sea += 5; else reasons.push("UTM_MISSING");

  // Tracking (0–10)
  let track = 0;
  if (signals.ga4Present || signals.gtmPresent) track += 6; else reasons.push("TRACKING_MISSING");
  if (signals.consentVisible) track += 4; else reasons.push("CONSENT_UNCLEAR");

  // Sum & caps
  let totalRaw = clarity + cta + trust + ux + sea + track;
  let score = Math.max(0, Math.min(100, totalRaw));

  if (reasons.includes("FORM_BROKEN")) score = Math.min(score, calibration.blockers.formBrokenCap);
  if (reasons.includes("HTTP_NOT_OK")) score = Math.min(score, calibration.blockers.httpNotOkCap);

  // Funnel bias
  if (signals.funnelGoal) {
    const fb: Record<string, number> = (calibration as any).funnelBias || {};
    const bias = (fb as any)[signals.funnelGoal] ?? fb._default ?? 0;
    score += bias;
  }

  confidence = Math.max(0.6, Math.min(1, confidence));

  return {
    score: Math.round(score),
    version: SCORING_VERSION,
    confidence: Number(confidence.toFixed(2)),
    reasons,
    categoryScores: {
      clarity_offer: Number(clarity.toFixed(1)),
      cta_friction: Number(cta.toFixed(1)),
      trust_proof: Number(trust.toFixed(1)),
      ux_perf: Number(ux.toFixed(1)),
      sea_match: Number(sea.toFixed(1)),
      tracking: Number(track.toFixed(1))
    }
  };
}
