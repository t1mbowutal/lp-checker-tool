export const metadata = { title: 'Sample Landingpage' };

export default function Sample() {
  return (
    <main style={{maxWidth:800, margin:'0 auto'}}>
      <h1>All-in-One Pressure Monitoring</h1>
      <p>Reduce downtime by 27% with continuous sensor insights. Install in minutes.</p>
      <a href="#" style={{display:'inline-block', padding:'10px 14px', background:'#ff6e00', color:'#fff', borderRadius:10, textDecoration:'none'}}>Get a demo</a>
      <section style={{marginTop:24}}>
        <h2>Why it works</h2>
        <ul>
          <li>Accurate readings in harsh environments</li>
          <li>Seamless PLC connectivity</li>
          <li>Predictive maintenance alerts</li>
        </ul>
      </section>
    </main>
  );
}
