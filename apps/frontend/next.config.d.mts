import type { NextConfig } from "next/dist/server/config-shared";

// Use the config contract without pulling Next's global ProcessEnv augmentation
// into independent backend/CLI tests that also inspect this JavaScript config.
declare const config: NextConfig & {
  images: NonNullable<NextConfig["images"]>;
  experimental: NonNullable<NextConfig["experimental"]>;
};
export default config;
