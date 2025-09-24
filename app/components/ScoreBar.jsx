import { clamp } from '../lib/utils';

export default function ScoreBar({ label, score }) {
  const s = clamp(score ?? 0);
  let bg = '#991b1b'; // red
  if (s >= 67) bg = '#166534'; // green
  else if (s >= 34) bg = '#b45309'; // orange

  return (
    <div style={{display:'flex', flexDirection:'column', gap:6}}>
      <div style={{fontSize:12, color:'#9ca3af'}}>{label}</div>
      <div style={{
        width:'100%',
        backgroundColor:'#111827',
        border:'1px solid #1f2937',
        borderRadius:10,
        overflow:'hidden',
        height:16
      }}>
        <div style={{width:`${s}%`, backgroundColor:bg, height:'100%'}} />
      </div>
      <div style={{fontSize:12, color:'#e5e7eb'}}>{s}/100</div>
    </div>
  );
}