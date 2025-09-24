# Next.js Drop-in: /pages/fallback.tsx

**Ziel:** Diese Seite kann **ohne weitere Abhängigkeiten** in ein bestehendes Next.js-Repo kopiert werden.
Sie spiegelt die Fallback-UI 1:1 (Link-Farbe oben, Feedback-Dropdown, Score → kurze Management Summary + Improvements).

## Nutzung
1. Lege (falls nicht vorhanden) den Ordner **/pages** an.
2. Kopiere **pages/fallback.tsx** in dein Repo.
3. Commit & Push → Vercel baut das Projekt wie gewohnt.
4. Aufruf unter: **/fallback** (z. B. https://dein-projekt.vercel.app/fallback)

### Link-Farbe oben (weiß/orange)
- Standard ist **weiß**.
- Orange aktivierst du mit **?links=orange**, z. B. `/fallback?links=orange`.

## Wichtige Hinweise für Vercel (Node 22)
Setze in deiner **package.json** (Root des Repos):
```json
"engines": {
  "node": "22.x"
}
```
Optional kannst du Vercel hart auf Node 22 pinnen (falls du eine `vercel.json` verwendest):
```json
{
  "functions": {
    "api/**.js": { "runtime": "nodejs22.x" },
    "api/**.ts": { "runtime": "nodejs22.x" }
  }
}
```
> Wenn dein Projekt **rein statisch** sein soll, entferne ggf. alte Build-Reste und `package.json`. Für Next.js brauchst du sie aber in der Regel.

## Was wurde NICHT geändert
- Kein globales CSS, keine externen Libraries.
- Keine Änderungen an deiner Build-Pipeline – nur **eine** neue Seite.

© Tim Clausen 2025 · Build: 2025-09-24
