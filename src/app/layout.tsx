import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "天心苑 祈祷室",
  description: "バーチャル天心苑祈祷室 — 皆と一緒に祈祷会へ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "天心苑 祈祷室",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col bg-[#080e20] text-white">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
