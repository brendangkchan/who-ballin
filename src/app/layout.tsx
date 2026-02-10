import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: [{ path: "../../public/fonts/Geist-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [{ path: "../../public/fonts/GeistMono-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-geist-mono",
  display: "swap",
});

const newsreader = localFont({
  src: [
    { path: "../../public/fonts/Newsreader16pt-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Newsreader16pt-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Newsreader16pt-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Newsreader16pt-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Who Ballin - Top NBA Players This Week",
  description: "Players with at least 2 games, 20 pts, and 40 minutes this week, ranked by PER",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' } as React.CSSProperties}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
