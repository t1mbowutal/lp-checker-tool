export type FeatureSet = {
  hero?: { headline_quality?: number; value_prop?: number; cta_atf?: number };
  cta?: { primary_present?: boolean; contrast?: number; tap_target_ok?: boolean; secondary_present?: boolean };
  form?: { fields?: number; progressive?: boolean; inline_validation?: boolean; mandatory_ratio?: number; privacy_hint?: boolean };
  trust?: { iso?: boolean; awards?: boolean; privacy_hint?: boolean; security_hint?: boolean };
  proof?: { testimonials?: number; cases?: number; reviews?: number; client_logos?: number };
  mobile?: { viewport_ok?: boolean; tap_issues?: number; sticky_overlap?: boolean };
  speed?: { hero_img_kb?: number; blocking_head_tags?: number; font_blocking?: boolean; percentile?: number };
  copy?: { benefit_bullets?: boolean; numbers_in_copy?: boolean; jargon_ratio?: number };
  seo_misc?: { h1?: boolean; title_ok?: boolean; schema_faq?: boolean; missing_title_or_h1?: boolean };
};

export type ScoreResult = {
  total: number;
  perPillar: Record<string, number>;
  calibration: { a: number; b: number; min: number; max: number };
};

export type WeightsConfig = {
  version: string;
  calibration: { a: number; b: number; bias_offset?: number; min: number; max: number };
  pillars: Record<string, any>;
};
