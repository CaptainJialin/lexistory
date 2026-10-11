import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { AppBoot } from "@/components/app-boot";
import { PlatformSupport } from "@/components/platform-support";
import "./globals.css";

export const metadata: Metadata = {
  title: "LexiStory - 语境式英语学习",
  description: "输入单词和语法，生成属于你的英文文章",
  applicationName: "LexiStory",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "LexiStory" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#294c3b" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <AppBoot />
        <PlatformSupport />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
