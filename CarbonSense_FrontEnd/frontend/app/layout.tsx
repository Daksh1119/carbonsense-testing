import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import ThemeProvider from "@/components/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

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
        </ThemeProvider>
      </body>
    </html>
  );
}
import { useUserStore } from '@/store';

function DebugUserOverlay() {
  if (process.env.NODE_ENV !== 'development') return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user, isAuthenticated } = useUserStore();
  if (!isAuthenticated || !user) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      right: 12,
      zIndex: 9999,
      background: 'rgba(30,41,59,0.95)',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: 8,
      fontSize: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      pointerEvents: 'none',
      opacity: 0.95,
    }}>
      <div><b>Role:</b> {user.role}</div>
      <div><b>Email:</b> {user.email}</div>
      <div><b>Approved:</b> {String(user.approved)}</div>
    </div>
  );
}

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
