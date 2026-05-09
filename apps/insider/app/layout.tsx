import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Anton, Bebas_Neue, IBM_Plex_Sans_Thai_Looped } from "next/font/google";
import "./globals.css";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas",
  display: "swap",
});

const plexThai = IBM_Plex_Sans_Thai_Looped({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Insider — เกมคนวงใน",
  description: "Insider game by Headball Social Hub.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="th"
      className={`${anton.variable} ${bebasNeue.variable} ${plexThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-on-dark font-body">
        {children}
      </body>
    </html>
  );
}
