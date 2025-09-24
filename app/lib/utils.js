export function shortenUrl(u, max=64) {
  if (!u) return '';
  const s = String(u);
  if (s.length <= max) return s;
  const head = s.slice(0, Math.floor(max*0.6));
  const tail = s.slice(-Math.floor(max*0.3));
  return head + '…' + tail;
}
export function clamp(n, min=0, max=100) {
  return Math.max(min, Math.min(max, n));
}