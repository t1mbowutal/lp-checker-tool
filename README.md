# LP Checker — Clean Build (No Fallback)

- No navigation placeholders.
- URL label is shortened visually and rendered in white for readability.
- Color-coded bars: Red (low), Orange (mid), Green (high).
- Real scoring: serverless API `/api/analyze` fetches the URL and applies weighted rules (no placeholders).

## Deploy

1. Create a new empty GitHub repo.
2. Upload all files from this ZIP.
3. Vercel: Import the repo, Framework = Next.js.
4. Ensure Node 22 is used (engines set). No `/fallback` route exists.

## Dev

```bash
npm i
npm run dev
```