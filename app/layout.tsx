import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AppBoot } from "@/components/app-boot";
import "./globals.css";

export const metadata: Metadata = {
  title: "LexiStory - 语境式英语学习",
  description: "输入单词和语法，生成属于你的英文文章",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <AppBoot />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
