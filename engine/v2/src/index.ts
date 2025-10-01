diff --git a//dev/null b/engine/v2/index.ts
index 0000000000000000000000000000000000000000..9e8b2263ba312f7af8e55cddb5abe2afdbb55b0d 100644
--- a//dev/null
+++ b/engine/v2/index.ts
@@ -0,0 +1,284 @@
+import { clamp } from "../types";
+import type { ScoreContext, ScoreResult } from "../types";
+
+const CTA_TERMS = [
+  "cta",
+  "contact",
+  "angebot",
+  "quote",
+  "request",
+  "demo",
+  "trial",
+  "consultation",
+  "schedule",
+  "get started",
+  "jetzt",
+  "jetzt starten",
+  "jetzt anfragen",
+  "buy",
+  "purchase",
+  "book",
+  "reserve",
+];
+
+const PRICING_TERMS = [
+  "pricing",
+  "preis",
+  "kosten",
+  "gebühr",
+  "fee",
+  "angebot",
+  "plans",
+  "paket",
+  "quote",
+  "cost",
+];
+
+const TRUST_TERMS = [
+  "testimonial",
+  "case study",
+  "success story",
+  "kundenstimme",
+  "kundenerfolg",
+  "review",
+  "rating",
+  "stars",
+  "award",
+  "auszeichnung",
+  "iso",
+  "zert",
+  "cert",
+  "guarantee",
+  "garantie",
+  "security",
+  "sicherheit",
+];
+
+const URGENCY_TERMS = [
+  "today",
+  "heute",
+  "jetzt",
+  "limited",
+  "sofort",
+  "immediately",
+  "nur für kurze zeit",
+];
+
+const STRUCTURED_DATA_TERMS = ["ld+json", "schema.org", "application/ld+json"];
+
+function countMatches(text: string, needles: string[]) {
+  const lower = text.toLowerCase();
+  return needles.reduce((acc, needle) => (lower.includes(needle) ? acc + 1 : acc), 0);
+}
+
+function hasLengthBetween(value: string, min: number, max: number) {
+  const len = value.trim().length;
+  return len >= min && len <= max;
+}
+
+export function score({ $, url }: ScoreContext): ScoreResult {
+  const text = $.text() || "";
+  const lowerText = text.toLowerCase();
+  const html = $.html() || "";
+
+  const positives: string[] = [];
+  const improvements: string[] = [];
+
+  let technical = 0;
+  const hasHttps = url.startsWith("https://");
+  if (hasHttps) {
+    technical += 15;
+    positives.push("HTTPS in place");
+  } else {
+    improvements.push("Serve the landing page via HTTPS");
+  }
+
+  const title = $("title").first().text().trim();
+  if (title) {
+    if (hasLengthBetween(title, 30, 65)) {
+      technical += 20;
+      positives.push("Title within 30–65 characters");
+    } else {
+      technical += 10;
+      positives.push("Title present");
+      improvements.push("Tighten the <title> to roughly 30–65 characters");
+    }
+  } else {
+    improvements.push("Add a focused, keyworded <title>");
+  }
+
+  const meta = $('meta[name="description"]').attr("content")?.trim() || "";
+  if (meta) {
+    if (hasLengthBetween(meta, 120, 160)) {
+      technical += 15;
+      positives.push("Meta description length on point");
+    } else {
+      technical += 8;
+      positives.push("Meta description present");
+      improvements.push("Polish the meta description to 120–160 characters");
+    }
+  } else {
+    improvements.push("Add a compelling meta description (120–160 characters)");
+  }
+
+  const h1 = $("h1").first().text().trim();
+  if (h1) {
+    technical += 15;
+    positives.push("Primary H1 present");
+  } else {
+    improvements.push("Introduce a single descriptive H1");
+  }
+
+  const canonical = $('link[rel="canonical"]').attr("href") || "";
+  if (canonical) {
+    technical += 10;
+    positives.push("Canonical tag found");
+  } else {
+    improvements.push("Declare a canonical URL");
+  }
+
+  const hasStructuredData = STRUCTURED_DATA_TERMS.some((needle) => html.toLowerCase().includes(needle));
+  if (hasStructuredData) {
+    technical += 10;
+    positives.push("Structured data snippet present");
+  } else {
+    improvements.push("Add JSON-LD or structured data for rich results");
+  }
+
+  const hasLanguage = $("html").attr("lang")?.trim();
+  if (hasLanguage) {
+    technical += 10;
+    positives.push("<html lang> attribute set");
+  } else {
+    improvements.push("Set the <html lang> attribute for accessibility");
+  }
+
+  technical = clamp(technical);
+
+  let bofu = 0;
+  const formCount = $("form").length;
+  if (formCount > 0) {
+    bofu += Math.min(40, formCount * 20);
+    positives.push("Lead form detected");
+  } else {
+    improvements.push("Add a short lead form or sticky contact form");
+  }
+
+  const telLinks = $('a[href^="tel:"]').length;
+  const mailLinks = $('a[href^="mailto:"]').length;
+  if (telLinks + mailLinks > 0) {
+    bofu += 15;
+    positives.push("Direct contact links available");
+  } else {
+    improvements.push("Offer tel/mailto or WhatsApp for quick outreach");
+  }
+
+  const ctaButtons = $("button, a.button, a.btn, a[role='button'], a.cta");
+  const ctaCopy = ctaButtons
+    .map((_, el) => $(el).text())
+    .get()
+    .join(" ")
+    .toLowerCase();
+  const hasCTA = CTA_TERMS.some((term) => lowerText.includes(term) || ctaCopy.includes(term));
+  if (hasCTA) {
+    bofu += 20;
+    positives.push("Clear call-to-action language");
+  } else {
+    improvements.push("Surface a stronger CTA (" + CTA_TERMS.slice(0, 4).join(", ") + ")");
+  }
+
+  const mentionsPricing = PRICING_TERMS.some((term) => lowerText.includes(term));
+  if (mentionsPricing) {
+    bofu += 15;
+    positives.push("Pricing or offer signals visible");
+  } else {
+    improvements.push("Clarify pricing, packages, or how to request a quote");
+  }
+
+  const schedulingWidgets = $("iframe[src*='calendly'], iframe[src*='hubspot'], script[src*='calendly'], script[src*='hubspot']").length;
+  if (schedulingWidgets > 0) {
+    bofu += 10;
+    positives.push("Scheduling widget embedded");
+  } else {
+    improvements.push("Embed a booking widget or link to calendar for quick demos");
+  }
+
+  const urgencyHits = countMatches(lowerText, URGENCY_TERMS);
+  if (urgencyHits > 0) {
+    bofu += Math.min(urgencyHits * 5, 10);
+    positives.push("Sense of urgency present");
+  } else {
+    improvements.push("Add urgency or time-bound language around the offer");
+  }
+
+  bofu = clamp(bofu);
+
+  let convincing = 0;
+  const trustHits = countMatches(lowerText, TRUST_TERMS);
+  const trustScore = Math.min(trustHits * 10, 30);
+  convincing += trustScore;
+  if (trustScore > 0) {
+    positives.push("Trust or certification cues found");
+  } else {
+    improvements.push("Add testimonials, certifications, or awards");
+  }
+
+  const testimonialBlocks = $("section.testimonial, .testimonial, blockquote, [data-testimonial]").length;
+  if (testimonialBlocks > 0) {
+    convincing += Math.min(testimonialBlocks * 10, 20);
+    positives.push("Testimonials highlighted on page");
+  } else {
+    improvements.push("Showcase testimonials or proof quotes");
+  }
+
+  const statMatches = html.match(/\b\d{2,3}(?:[\.,]\d{2})?%?\b/g) || [];
+  const statScore = Math.min(statMatches.length * 5, 20);
+  convincing += statScore;
+  if (statScore >= 10) {
+    positives.push("Quantified outcomes visible");
+  } else {
+    improvements.push("Quantify outcomes with metrics or % improvements");
+  }
+
+  const logoMatches = $("img[alt*='logo'], img[alt*='kunde'], img[alt*='client'], img[alt*='partner']").length;
+  if (logoMatches > 0) {
+    convincing += Math.min(logoMatches * 5, 15);
+    positives.push("Client or partner logos present");
+  } else {
+    improvements.push("Add client/partner logos for social proof");
+  }
+
+  const pressMentions = $("section.press, .press, img[alt*='press'], a[href*='press']").length;
+  if (pressMentions > 0) {
+    convincing += Math.min(pressMentions * 5, 15);
+    positives.push("Press or media mentions showcased");
+  } else {
+    improvements.push("Highlight media coverage or recognition");
+  }
+
+  convincing = clamp(convincing);
+
+  const overall = clamp(0.35 * bofu + 0.35 * convincing + 0.3 * technical);
+
+  const sorted = [
+    { key: "BoFu", value: bofu },
+    { key: "Convincing", value: convincing },
+    { key: "Technical", value: technical },
+  ].sort((a, b) => a.value - b.value);
+
+  const mgmt =
+    `Strict grading snapshot — Overall ${Math.round(overall)}. ` +
+    `${sorted[0].key} (${Math.round(sorted[0].value)}) trails most; ` +
+    `${sorted[1].key} (${Math.round(sorted[1].value)}) follows; ` +
+    `${sorted[2].key} (${Math.round(sorted[2].value)}) leads. ` +
+    `Prioritise ${sorted[0].key.toLowerCase()} fixes first to close the gap.`;
+
+  return {
+    scores: { overall, bofu, convincing, technical },
+    positives,
+    improvements,
+    mgmt,
+  };
+}
+
+export default score;
