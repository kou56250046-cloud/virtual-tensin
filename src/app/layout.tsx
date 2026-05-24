import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "天心苑 祈祷室",
  description: "バーチャル天心苑祈祷室 — 皆と一緒に祈祷会へ",
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
      </body>
    </html>
  );
}
