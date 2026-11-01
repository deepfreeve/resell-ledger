import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.usecache.cache",
  appName: "CACHE",
  webDir: "public",
  android: {
    allowMixedContent: false
  }
};

export default config;
