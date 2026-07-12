import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/lib/i18n-context";

export const metadata: Metadata = {
  title: "Prestige Garage AI-OS | نظام إدارة مركز برستيج جراج",
  description: "نظام إدارة ذكي داخلي لمركز Prestige Garage للعناية بالسيارات الفاخرة — مع مساعد ذكي AI متكامل",
  keywords: ["Prestige Garage", "إدارة ورشة", "PPF", "ديتيلنج", "AI Assistant", "بروتيكشن"],
  authors: [{ name: "Prestige Garage" }],
  manifest: "/manifest.json",
  applicationName: "Prestige Garage",
  appleWebApp: {
    capable: true,
    title: "Prestige Garage",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Prestige Garage AI-OS",
    description: "نظام إدارة ذكي لمركز العناية بالسيارات الفاخرة",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#DC143C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* PWA install support */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Prestige Garage" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased bg-background text-foreground">
        <I18nProvider>{children}</I18nProvider>
        <Toaster />
      </body>
    </html>
  );
}
