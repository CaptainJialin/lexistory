import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lexistory.app",
  appName: "LexiStory",
  webDir: ".mobile-build/out",
  backgroundColor: "#f7f7f2",
  // Bundle the frontend locally. AI requests use NEXT_PUBLIC_API_BASE_URL.
  server: { androidScheme: "https", iosScheme: "capacitor" },
};
export default config;
