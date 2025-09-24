

## Feedback & CSV (neu)
- **Feedback-Zeile hinzufügen**: speichert die aktuelle Analyse als Reihe (lokal).
- **CSV herunterladen**: exportiert alle Zeilen (Header inkl.).
- **CSV importieren**: Datei mit Spalten
  `url,title_ok,meta_ok,h1_ok,words_ok,canonical_ok,robots_ok,images_ok,alt_ratio,target_score`
  einlesen → **Gewichte lernen** (lineare Regression, client-seitig).
- **Custom-Score** = dot(Gewichte, Features) + Bias (0–100 gekappt).
- Alle Daten/Weights werden **in localStorage** gehalten (keine Server-Datenbank).
