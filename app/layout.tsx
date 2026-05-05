import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="sticky top-0 z-10 border-b bg-white/80 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <a href="/" className="text-lg font-bold tracking-tight text-zinc-900">
              LexiStory
            </a>
            <nav className="flex items-center gap-4 text-sm">
              <a href="/" className="text-zinc-600 hover:text-zinc-900">生成文章</a>
              <a href="/wordbook" className="text-zinc-600 hover:text-zinc-900">单词本</a>
              <a href="/history" className="text-zinc-600 hover:text-zinc-900">历史记录</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
