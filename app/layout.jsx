export const metadata = {
  title: 'Bottom of Funnel (BoFu) Landing Page Checker',
  description: 'Analyze BoFu landing pages and score key dimensions.',
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: '#0f1115',
          color: '#e5e7eb',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, Apple Color Emoji, Segoe UI Emoji'
        }}
      >
        {children}
        <footer style={{marginTop: 40, padding: '12px 24px', borderTop: '1px solid #1f2937', fontSize: 12, color: '#9ca3af'}}>
          © Tim Clausen 2025 — This tool targets BoFu/convincing use-cases, non-general websites.
        </footer>
      </body>
    </html>
  );
}