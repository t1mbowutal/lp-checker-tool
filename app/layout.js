export const metadata = {
  title: 'SEA Landingpage Checker',
  description: 'Analyse von Landingpages (SEO/SEA Basics) mit PDF-Export',
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body style={{fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', background:'#0b0f14', color:'#e6e9ef', margin:0}}>
        <div style={{maxWidth: '980px', margin:'0 auto', padding:'24px'}}>
          {children}
        </div>
        <footer style={{textAlign:'center', padding:'24px', opacity:0.7}}>
          © Tim Clausen 2025
        </footer>
      </body>
    </html>
  );
}
