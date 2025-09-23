
# SEA Landingpage Checker

## Deploy (Vercel)
1) Neues Projekt von diesem Repo/ZIP in Vercel importieren
2) Build Command: `npm run build`
3) Output: default (Next.js 14 App Router)
4) Node.js-Version: 18.x (Standard bei Vercel)
5) Keine weiteren Env Vars nötig

## Funktionen
- URL-Analyse via Serverless API (`/api/analyze`) mit cheerio
- Scoring (0–100) mit klaren Gewichten (`config/weights.json`)
- Management Summary automatisch generiert
- Export: PDF & CSV (Feedback)
- Beispiel-Leadgen-Seite: `/example/leadgen`
- Saubere UI, Footer: (c) Tim Clausen 2025

## Hinweise
- Wir erkennen **kein Tracking** (bewusst entfernt, um False Positives zu vermeiden).
- Keine Dummy-Ausgaben. Jeder Check basiert auf echten Page-Daten.
