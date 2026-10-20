const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

export default {
  reactStrictMode: true,
  // Freeze even absent flags so server rendering and browser code agree, and
  // changing runtime env cannot opt a previously built app into TEST.
  env: {
    NEXT_PUBLIC_CLUB_TEST_CHECKOUT:
      process.env.NEXT_PUBLIC_CLUB_TEST_CHECKOUT ?? "false",
    NEXT_PUBLIC_PRODAMUS_TEST_ENABLED:
      process.env.NEXT_PUBLIC_PRODAMUS_TEST_ENABLED ?? "false",
    NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED:
      process.env.NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED ?? "false",
    NEXT_PUBLIC_VK_CATALOG_ENABLED:
      process.env.NEXT_PUBLIC_VK_CATALOG_ENABLED ?? "false",
    NEXT_PUBLIC_PRIVATE_LIBRARY_FILES_ENABLED:
      process.env.NEXT_PUBLIC_PRIVATE_LIBRARY_FILES_ENABLED ?? "false",
  },
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3.twcstorage.ru",
        port: "",
        pathname: "/daryadarcy-s3/feed/**",
        search: "",
      },
    ],
    localPatterns: [{ pathname: "/assets/responsive/**", search: "" }],
    deviceSizes: [320, 480, 640, 960, 1440],
    imageSizes: [160],
    qualities: [75],
    formats: ["image/webp"],
    maximumRedirects: 0,
    maximumResponseBody: 8 * 1024 * 1024,
    maximumDiskCacheSize: 128 * 1024 * 1024,
    minimumCacheTTL: 3600,
    dangerouslyAllowLocalIP: false,
    dangerouslyAllowSVG: false,
  },
  experimental: {
    imgOptConcurrency: 1,
    // Keep decoded source images out of the native operation cache.
    // Compressed previews still use the bounded persistent disk cache.
    imgOptOperationCache: false,
    imgOptMaxInputPixels: 20_000_000,
    imgOptTimeoutInSeconds: 10,
  },
  async headers() {
    return [
      {
        source: "/assets/responsive/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async rewrites() {
    if (!target) return [];
    return [
      { source: "/api/:path*", destination: `${target}/api/:path*` },
      { source: "/media/:path*", destination: `${target}/media/:path*` },
    ];
  },
};
