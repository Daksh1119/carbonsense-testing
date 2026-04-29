import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import ThemeProvider from "@/components/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

import DebugUserOverlay from '@/components/DebugUserOverlay';

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CarbonSense - Carbon Intelligence Platform",
  description:
    "Multi-agentic AI carbon management platform helping individuals and SMEs measure, understand, reduce, and strategically manage their carbon emissions.",
  keywords: [
    "carbon tracking",
    "emissions management",
    "TEME",
    "tree planting",
    "policy intelligence",
    "CCUS",
    "carbon compliance",
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} font-display antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <Toaster position="top-right" />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AuthProvider>
          <DebugUserOverlay />
        </ThemeProvider>
      </body>
    </html>
  );
}
