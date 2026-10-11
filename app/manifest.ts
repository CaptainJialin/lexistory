import type { MetadataRoute } from "next";
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "LexiStory · 在故事里学英语", short_name: "LexiStory",
    description: "每天一篇，让单词在语境里被记住。",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#f7f7f2", theme_color: "#294c3b", lang: "zh-CN",
    icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
  };
}
