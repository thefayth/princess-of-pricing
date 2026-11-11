import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@pop/ui/styles.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Princess of Pricing",
    template: "%s | Princess of Pricing",
  },
  description: "Evidence-backed price, subscription, and rewards intelligence under your control.",
  openGraph: {
    title: "Princess of Pricing",
    description: "Evidence-backed savings intelligence under your control.",
    images: ["/assets/princess/faith-blue.png"],
  },
  icons: {
    icon: "/assets/princess/faith-blue.png",
    shortcut: "/assets/princess/faith-blue.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
