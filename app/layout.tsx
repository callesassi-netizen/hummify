import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Hummify — Nynna en låt, vi gissar",
  description:
    "Nynna, sjung eller vissla en melodi och låt Hummify föreslå låten. Premium-melodiigenkänning byggd med Web Audio API.",
  applicationName: "Hummify",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hummify",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#070512",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <div className="app-bg" aria-hidden />
        {children}
      </body>
    </html>
  );
}
