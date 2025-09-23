
export default function ExampleLeadgen(){
  return (
    <div style={{maxWidth:960, margin:'0 auto', padding:'24px'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontWeight:800, letterSpacing:0.5}}>ifm — Example Leadgen</div>
        <a href="/" style={{color:'#ff6e00'}}>← Back</a>
      </header>
      <section style={{marginTop:24, padding:'24px', border:'1px solid #1f2937', borderRadius:16}}>
        <h1 style={{marginTop:0}}>Pressure Sensor PQ Cube — Request a Demo</h1>
        <p>Reliable measurement, fast installation, industry-ready. Get a live demo tailored to your use-case.</p>
        <ul>
          <li>✔ Fast setup, compact form</li>
          <li>✔ High accuracy & durability</li>
          <li>✔ Integrates with common PLCs</li>
        </ul>
        <form style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}} onSubmit={(e)=>e.preventDefault()}>
          <input placeholder="First name*" required style={{padding:10, borderRadius:12, border:'1px solid #1f2937', background:'#0b1220', color:'#e5e7eb'}}/>
          <input placeholder="Last name*" required style={{padding:10, borderRadius:12, border:'1px solid #1f2937', background:'#0b1220', color:'#e5e7eb'}}/>
          <input placeholder="Work email*" required type="email" style={{padding:10, borderRadius:12, border:'1px solid #1f2937', background:'#0b1220', color:'#e5e7eb'}}/>
          <input placeholder="Company" style={{padding:10, borderRadius:12, border:'1px solid #1f2937', background:'#0b1220', color:'#e5e7eb'}}/>
          <select style={{padding:10, borderRadius:12, border:'1px solid #1f2937', background:'#0b1220', color:'#e5e7eb'}}>
            <option>Use-case</option>
            <option>Leak detection</option>
            <option>Process monitoring</option>
            <option>Quality assurance</option>
          </select>
          <button style={{gridColumn:'1 / -1', padding:12, borderRadius:12, background:'#ff6e00', fontWeight:800}}>Request Demo</button>
        </form>
        <p style={{fontSize:12, color:'#9ca3af', marginTop:8}}>By submitting, you agree to be contacted regarding your request.</p>
      </section>
      <footer style={{marginTop:24, textAlign:'center', color:'#9ca3af', fontSize:12}}>(c) Tim Clausen 2025</footer>
    </div>
  );
}
