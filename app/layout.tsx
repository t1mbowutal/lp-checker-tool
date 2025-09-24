import "./globals.css";

export const metadata = {
  title: "Bottom of Funnel (BoFu) Landingpage Checker"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      </head>
      <body className="app">{children}</body>
    </html>
  );
}
