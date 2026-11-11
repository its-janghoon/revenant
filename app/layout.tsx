import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono, Special_Elite } from "next/font/google";
import type { ReactNode } from "react";
import { Configure } from "@/lib/configure";
import { themeScript } from "@/lib/theme/script";
import "@/lib/theme/tokens.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "700"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const type = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-type", display: "swap" });

export const metadata: Metadata = {
  title: "Revenant",
  description: "Lovable on your own AWS account.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Defaults for no-JS; the head script replaces them from localStorage before first paint.
  return (
    <html lang="en" data-mode="light" data-calm="off" data-snd="off" suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} ${serif.variable} ${type.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Configure />
        {children}
      </body>
    </html>
  );
}
