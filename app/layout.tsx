import type { Metadata } from "next";
import { EB_Garamond, Geist, Geist_Mono, Literata, Lora } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Real book-typesetting fonts for the reader (settings-panel previews).
// The actual EPUB content lives in an iframe — a separate document these
// CSS variables can't reach — so it loads the same families itself via a
// Google Fonts stylesheet link (see EpubReaderSurface).
const literata = Literata({ variable: "--font-literata", subsets: ["latin"], weight: "variable" });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"], weight: "variable" });
const garamond = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"], weight: "variable" });

export const metadata: Metadata = {
  title: "Kütüphanem",
  description: "E-ink hissiyatlı EPUB/PDF okuyucu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${literata.variable} ${lora.variable} ${garamond.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
