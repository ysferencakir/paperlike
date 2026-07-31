import type { Metadata, Viewport } from "next";
import { EB_Garamond, Geist, Geist_Mono, Literata, Lora } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { BackButtonHandler } from "@/components/BackButtonHandler";
import { OpenFileHandler } from "@/components/OpenFileHandler";
import { ShortcutHandler } from "@/components/ShortcutHandler";
import { CrashReportingHandler } from "@/components/CrashReportingHandler";
import { AuthHandler } from "@/components/AuthHandler";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import { DocumentLocaleSync } from "@/components/DocumentLocaleSync";
import { CONTENT_SECURITY_POLICY } from "@/lib/security-headers";
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
  applicationName: "Paperlike",
  title: "Paperlike — Kütüphanem",
  description: "E-ink hissiyatlı EPUB/PDF okuyucu",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Paperlike",
  },
  icons: {
    icon: "/icons/paperlike.svg",
  },
};

// viewportFit: "cover" is what makes env(safe-area-inset-*) return real
// values instead of always 0 — without it, content can render under a
// notch/status bar/rounded corners with no way to detect it in CSS.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#fbfaf8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} ${literata.variable} ${lora.variable} ${garamond.variable} h-full antialiased`}
    >
      <head>
        {/* Static export has no server to send a real CSP response header
            from (see lib/security-headers.ts) — this meta tag is the
            baseline that works on any static host. `frame-ancestors` and
            the other response-only headers still need public/_headers or
            vercel.json wired up once a host is chosen. */}
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <BackButtonHandler />
        <OpenFileHandler />
        <ShortcutHandler />
        <CrashReportingHandler />
        <AuthHandler />
        <PwaRegistrar />
        <DocumentLocaleSync />
      </body>
    </html>
  );
}
