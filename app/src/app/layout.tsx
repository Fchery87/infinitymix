import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "InfinityMix - AI-Powered Mashup Creator",
  description: "Create professional-quality mashups in seconds with AI. No DAW, no music theory required.",
  keywords: ["music", "mashup", "AI", "audio", "mixing", "DJ"],
  authors: [{ name: "InfinityMix" }],
  openGraph: {
    title: "InfinityMix - AI-Powered Mashup Creator",
    description: "Create professional-quality mashups in seconds with AI",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F97316" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={plusJakarta.className}>
        <ErrorBoundary>
          <a 
            href="#main-content" 
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-md"
          >
            Skip to main content
          </a>
          <main id="main-content">{children}</main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
