
export const metadata = {
  title: 'SEA Landingpage Checker',
  description: 'Analyze and benchmark landing pages quickly.'
}
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }){
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
